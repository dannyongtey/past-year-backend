import * as utils from './utils'
import JSZip from 'jszip'

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
            ({buffer} = await utils.downloadPaperForID({ context, id }))
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

    async MultipleDownloadController(req, res) {
        const { body: { subjects } } = req
        const { allSubjectData, context } = await getSubjectsDetailsAndContext(subjects)
        const allPromises = []
        Object.entries(allSubjectData).forEach(([subject, details]) => {
            allPromises.push(
                {
                    [subject]: Promise.all(
                        details.map(detail => {
                            const { id } = detail
                            return utils.downloadPaperForID({ id, context })
                        })
                    )
                }

            )
        })
        let zip = new JSZip()
        for (const promises of allPromises) {
            const subject = Object.keys(promises)[0]
            const files = await Object.values(promises)[0]
            const folder = zip.folder(subject)
            files.forEach(file => {
                folder.file(`${file.id}.pdf`, file.buffer)
            })
        }
        const zipFile = await zip.generateAsync({type: "nodebuffer"})
        res.writeHead(200, {
            'Content-Type': 'application/zip',
            'Content-disposition': 'attachment;filename=' + 'files' + '.zip',
        });
        res.end(zipFile)
    }
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