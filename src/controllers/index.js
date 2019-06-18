import * as utils from './utils'

export default {
    async SearchController(req, res) {
        const { body: { subjects } } = req
        const allSubjectData = {}
        const {cookie} = await utils.loginOsmosis()
        await Promise.all(subjects.map(subject => {
            const url = utils.urlFor(subject)
            return new Promise(async (resolve, reject) => {
                const singleSubjectData = await utils.extractSubjectDataFrom({url, cookie})
                allSubjectData[subject] = singleSubjectData
                resolve()
            })
        }))
        res.status(200).json(allSubjectData)
        
    }
}