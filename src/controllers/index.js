import * as utils from './utils'
import JSZip from 'jszip'
import uuidv1 from 'uuid/v1'
import constants from './constants'
import { redisClient } from '../app'
import fs from 'fs';
import { promisify } from 'util';

const readFileAsync = promisify(fs.readFile)
const readDirAsync = promisify(fs.readdir)

export default {
    async SearchController(req, res) {
        const { body: { subjects } } = req
        const { allSubjectData } = await getSubjectsDetailsAndContext(subjects)
        res.status(200).json(allSubjectData)
    },

    async NewSingleDownloadController(req, res) {
        const { id } = req.params
        const files = await readDirAsync('/tmp')
        for (const file of files) {
            if (file.split('-')[0] === id) {
                // File found
                const buffer = await readFileAsync(`/tmp/${file}`)
                res.writeHead(200, {
                    'Content-Type': 'application/pdf',
                    'Content-disposition': 'attachment;filename=' + id + '.pdf',
                });

                res.end(new Buffer(buffer, 'null'));
                return
            }
        }
        res.status(404).json({ 'error': 'Paper not found for the given ID.' })
    },

    async SingleDownloadController(req, res) {
        const { params: { id } } = req
        const { context } = await utils.loginOsmosis()
        let buffer
        try {
            ({ buffer } = await utils.downloadPaperForID({ context, id }))
        } catch (_) {
            // res.status(404).send('Not found')
        }
        if (buffer) {
            res.writeHead(200, {
                'Content-Type': 'application/pdf',
                'Content-disposition': 'attachment;filename=' + id + '.pdf',
            });
            res.end(new Buffer(buffer, 'null'));
        } else {
            res.status(404).json({ 'error': 'Paper not found for the given ID.' })
        }
    },

    async MultipleSingleDownloadController(req, res) {
        const { body: { ids } } = req

        const downloadID = uuidv1()
        const idStats = {
            status: constants.STATUS.FETCHING,
            allSubjectData: ids,
        }

        multipleSingleDownload(downloadID, ids)
        redisClient.set(downloadID, JSON.stringify(idStats))
        res.status(200).json({
            status: 'downloading',
            message: "The files are being fetched and processed on the server.",
            id: downloadID,
        })

    },

    async MultipleDownloadController(req, res) {
        const { body: { subjects } } = req
        const downloadID = uuidv1()
        let allSubjectData, context
        if (Array.isArray(subjects)) {
            ({ allSubjectData, context } = await getSubjectsDetailsAndContext(subjects))
        } else {
            const allSubjects = Object.keys(subjects) // Subject code number are at keys
                ({ allSubjectData, context } = await getSubjectsDetailsAndContext(allSubjects))
        }
        console.log(allSubjectData)
        const idStats = {
            status: constants.STATUS.FETCHING,
            allSubjectData
        }
        redisClient.set(downloadID, JSON.stringify(idStats))
        multipleDownload(downloadID, subjects, context, allSubjectData)
        res.status(200).json({
            status: "downloading",
            message: "The files are being fetched and processed on the server.",
            id: downloadID,
        })
    },

    SendMultipleDownloadedFile(req, res) {
        const { params: { id } } = req

        redisClient.get(id, async (err, reply) => {
            const idStats = JSON.parse(reply)
            if (!idStats) {
                return res.status(404).json({ error: 'Shared ID not found.' })
            }
            if (idStats.status === constants.STATUS.DONE) {
                let zip = new JSZip()
                if (idStats.allSubjectData instanceof Array) {
                    for (const id of idStats.allSubjectData) {
                        const buf = await readFileAsync(`/tmp/${id}.pdf`)
                        zip.file(`${id}.pdf`, buf)
                    }
                } else {
                    for (const subject of Object.keys(idStats.allSubjectData)) {
                        const folder = zip.folder(subject)
                        const datas = idStats.allSubjectData[subject]
                        for (const data of datas) {
                            const { id } = data
                            const buf = await readFileAsync(`/tmp/${id}.pdf`)
                            folder.file(`${id}.pdf`, buf)
                        }

                    }
                }
                res.writeHead(200, {
                    'Content-Type': 'application/zip',
                    'Content-disposition': 'attachment;filename=' + 'files' + '.zip',
                });
                const zipFile = await zip.generateAsync({ type: "nodebuffer" })
                res.end(zipFile)
            } else {
                res.status(404).json({
                    status: reply,
                    message: "The file is not ready yet. There is likely to be additional status messages above.",
                })
            }
        })
    }
}

async function multipleSingleDownload(uuid, ids) {
    const { context } = await utils.loginOsmosis()

    const allPromises = []
    ids.forEach(id => {
        allPromises.push(
            fs.existsSync(`/tmp/${id}.pdf`) ? Promise.resolve() : utils.downloadPaperForID({ context, id })
        )
    })
    const papers = await Promise.all(allPromises)

    for (const paper of papers) {
        const { id, buffer } = paper
        if (buffer) {
            fs.writeFile(`/tmp/${id}.pdf`, buffer)
        }
    }

    redisClient.get(uuid, (err, reply) => {
        const idStats = JSON.parse(reply)
        idStats.status = constants.STATUS.DONE
        redisClient.set(uuid, JSON.stringify(idStats))
    })
    return { papers }

}

async function multipleDownload(uuid, _, context, allSubjectData) {
    const allPromises = []
    Object.entries(allSubjectData).forEach(([subject, details]) => {
        allPromises.push(
            {
                [subject]: Promise.all(
                    details.map(detail => {
                        const { id } = detail
                        if (fs.existsSync(`/tmp/${id}.pdf`)) {
                            return null
                        }
                        return utils.downloadPaperForID({ id, context })
                    })
                )
            }

        )
    })
    for (const promises of allPromises) {
        const files = await Object.values(promises)[0]
        files.forEach(file => {
            if (file) {
                fs.writeFile(`/tmp/${file.id}.pdf`, file.buffer)
            }
        })
    }

    redisClient.get(uuid, (err, reply) => {
        const idStats = JSON.parse(reply)
        idStats.status = constants.STATUS.DONE
        redisClient.set(uuid, JSON.stringify(idStats))
    })
}

async function getSubjectsDetailsAndContext(subjects) {
    const allSubjectData = {}
    const { cookie, context } = await utils.loginOsmosis()
    await Promise.all(subjects.map(subject => {
        const url = utils.urlFor(subject)
        return new Promise(async (resolve, reject) => {
            const singleSubjectData = await utils.extractSubjectDataFrom({ url, cookie })
            allSubjectData[subject] = singleSubjectData
            resolve()
        })
    }))
    return ({ allSubjectData, context })
}