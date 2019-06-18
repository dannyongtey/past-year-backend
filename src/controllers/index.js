import * as utils from './utils'

export default {
    async SearchController(req, res) {
        const { body: { subjects } } = req
        const allSubjectData = {}
        const { cookie } = await utils.loginOsmosis()
        await Promise.all(subjects.map(subject => {
            const url = utils.urlFor(subject)
            return new Promise(async (resolve, reject) => {
                const singleSubjectData = await utils.extractSubjectDataFrom({ url, cookie })
                allSubjectData[subject] = singleSubjectData
                resolve()
            })
        }))
        res.status(200).json(allSubjectData)
    },

    async SingleDownloadController(req, res) {
        const { params: { id } } = req
        const { context } = await utils.loginOsmosis()
        let file
        try {
            file = await utils.downloadPaperForID({ context, id })
        } catch (_) {
            // res.status(404).send('Not found')
        }
        if (file){
            res.writeHead(200, {
                'Content-Type': 'application/pdf',
                'Content-disposition': 'attachment;filename=' + id + '.pdf',
            });
            res.end(new Buffer(file, 'null'));
        } else {
            res.status(404).json({'error': 'Paper not found for the given ID.'})
        }

    }
}