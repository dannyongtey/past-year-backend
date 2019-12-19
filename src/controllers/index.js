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
}