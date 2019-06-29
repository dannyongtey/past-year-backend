import * as utils from './utils'
import JSZip from 'jszip'
import uuidv1 from 'uuid/v1'
import constants from './constants'
import { redisClient } from '../app'
import fs from 'fs';
import { promisify } from 'util';


export default {
    async SearchController(req, res) {
        const { body: { subjects } } = req
        const { allSubjectData } = await getSubjectsDetailsAndContext(subjects)
        res.status(200).json(allSubjectData)
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
        const { context } = await utils.loginOsmosis()
        const allPromises = []
        ids.forEach(id => {
            allPromises.push(
                utils.downloadPaperForID({ context, id })
            )
        })
        const papers = await Promise.all(allPromises)
        let zip = new JSZip()
        for (const paper of papers) {
            if (paper) {
                zip.file(`${paper.id}.pdf`, paper.buffer)
            }
        }
        res.writeHead(200, {
            'Content-Type': 'application/zip',
            'Content-disposition': 'attachment;filename=' + 'files' + '.zip',
        });
        const zipFile = await zip.generateAsync({ type: "nodebuffer" })
        res.end(zipFile)
    },

    async MultipleDownloadController(req, res) {
        const { body: { subjects } } = req
        const downloadID = uuidv1()
        const { allSubjectData, context } = await getSubjectsDetailsAndContext(subjects)
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
        const readFileAsync = promisify(fs.readFile)

        redisClient.get(id, async (err, reply) => {
            const idStats = JSON.parse(reply)
            if (idStats.status === constants.STATUS.DONE) {
                let zip = new JSZip()
                for (const subject of Object.keys(idStats.allSubjectData)) {
                    const folder = zip.folder(subject)
                    const datas = idStats.allSubjectData[subject]
                    for (const data of datas) {
                        const { id } = data
                        const buf = await readFileAsync(`/tmp/${id}.pdf`)
                        folder.file(`${id}.pdf`, buf)
                    }

                }
                res.writeHead(200, {
                    'Content-Type': 'application/zip',
                    'Content-disposition': 'attachment;filename=' + 'files' + '.zip',
                });
                const zipFile = await zip.generateAsync({ type: "nodebuffer" })
                res.end(zipFile)
            } else {
                res.status(200).json({
                    status: reply,
                    message: "The file is not ready yet. There is likely to be additional status messages above.",
                })
            }
        })
    }
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