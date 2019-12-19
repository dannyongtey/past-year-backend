import * as utils from './utils'
import JSZip from 'jszip'
import uuidv1 from 'uuid/v1'
import constants from './constants'
import { redisClient } from '../app'
import fs from 'fs';
import app from '../app'
import { promisify } from 'util';
// import meta from '../../meta.json'

const readFileAsync = promisify(fs.readFile)
const readDirAsync = promisify(fs.readdir)

export default {
    // API for Mobile
    async FileListController(req, res) {
        const file = JSON.parse(fs.readFileSync("meta.json"))
        res.status(200).json(file)
    },
    /// General API

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

    async SearchController(req, res) {
        const { body: { subjects } } = req
        try {
            const formattedSubjects = subjects.map(subject => utils.formatSubject(subject))
            const file = JSON.parse(fs.readFileSync("meta.json"))
            const results = file.filter(record => formattedSubjects.includes(record.code))
            res.status(200).json({ results })
        } catch (error) {
            res.status(422).json({ error: error.toString() })
        }
    },

    async MultipleSingleDownloadController(req, res) {
        const { body: { ids, id } } = req
        const allPapers = []
        for (const id of ids) {
            const file = await utils.getFileById(id)
            const fileInfo = { buffer: file, id }
            allPapers.push(fileInfo)
        }
        const allPapersZipped = await utils.zip(allPapers)
        res.writeHead(200, {
            'Content-Type': 'application/zip',
            'Content-disposition': 'attachment;filename=' + 'files' + '.zip',
        });
        res.end(allPapersZipped)
        utils.saveToRedis(id, { type: constants.TYPE.IDS, contents: ids }) // Save IDs
    },

    async MultipleDownloadController(req, res) {
        const { body: { subjects, id } } = req
        console.log(subjects)
        try {
            const zipFile = await utils.getFilesBySubjects(subjects)
            res.writeHead(200, {
                'Content-Type': 'application/zip',
                'Content-disposition': 'attachment;filename=' + 'files' + '.zip',
            });
            res.end(zipFile)
        } catch (err) {
            res.status(404).json({ error: err.toString() })
        }
        utils.saveToRedis(id, { type: constants.TYPE.SUBJECTS, contents: subjects }) // Save IDs
    },

    async SendFilesViaDownloadID(req, res, next) {
        const { body: { id } } = req
        const reply = await utils.readFromRedis(id)
        if (reply) {
            if (reply.type === constants.TYPE.IDS) {
                req.url = '/download/single' // Path to download by ID
                req.body.ids = reply.contents
                return app._router.handle(req, res, next)
            } else if (reply.type === constants.TYPE.SUBJECTS) {
                req.url = '/download/multiple'
                req.body.subjects = reply.contents
                return app._router.handle(req, res, next)
            } else {
                res.status(422).json({ error: "Unknown error" })
            }
        } else {
            res.status(404).json({ error: 'Not found' })
        }
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