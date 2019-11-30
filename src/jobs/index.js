import osmosis from 'osmosis'
import { loginOsmosis, downloadPaperForID } from '../controllers/utils'
import fs from 'fs'
import schedule from 'node-schedule'


schedule.scheduleJob('13 * * * *', function () {
    scrapeAllInformation()
});

export async function scrapeAllInformation() {
    const { cookie, context } = await loginOsmosis()
    // console.log(cookie)
    // Fetch JSON list
    const subjectList = {}
    const numbers = process.env.NODE_ENV === 'development' ? 5 : 99999
    const startFrom = 0
    // const url = `http://library.mmu.edu.my.proxyvlib.mmu.edu.my/library2/diglib/exam_col/tpimage.php?id=`
    const url = `http://library.mmu.edu.my/library2/diglib/exam_col/tpimage.php?id=`
    const searchPromises = () => Promise.all([...Array(numbers)].map((_, i) => {
        const id = 10000 + i + startFrom
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                const idURL = url + id.toString()
                let object = {}
                // osmosis.config('headers', { cookie })
                osmosis
                    .get(idURL)
                    .find('form')
                    .set({
                        'link': 'input[name="xfile"]@value'
                    })
                    .find('.smallcontent tr')
                    .set({
                        'column': 'td[1]',
                        'value': 'td[2]',
                    })
                    .data(items => { object[items['column']] = items['value']; object['Link'] = items['link'].split('.pdf')[0]; })
                    .log(console.log)
                    .error(console.log)
                    .debug(console.log)
                    .done(async () => {
                        if (!object['Title']) {
                            resolve(null)
                        } else {
                            const dl = object['Link']
                            object['ID'] = id
                            // console.log(object)
                            if (!fs.existsSync(`/tmp/${id}-${dl}.pdf`)) {
                                try {
                                    const { buffer } = await downloadPaperForID({ id: dl, context })
                                    fs.writeFile(`/tmp/${id}-${dl}.pdf`, buffer)
                                } catch (err) {
                                    console.log('error writing file', err)
                                }
                            }

                            const trimmedSubject = (object['Subject'] || '').replace(' ', '')
                            const rawSubjectCode = object['Title'].replace(' ', '').replace(trimmedSubject, '').replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, '')
                            const trimmedSubCode = rawSubjectCode.replace(/\s/g, '')
                            const filtered = {}
                            const whiteList = ['Collection Type', 'Title', 'Faculty', 'Frequency', 'Year', 'Subject', 'ID']
                            whiteList.forEach(key => {
                                filtered[key] = object[key]
                            })
                            if (!trimmedSubCode) console.log('somethign was wrong')
                            resolve({ [trimmedSubCode]: filtered })
                        }
                    })
            }, i * 15)


        })
    }))
    const results = await searchPromises()
    results.forEach(result => {
        if (result) {
            const subCode = Object.keys(result)[0]
            const info = Object.values(result)[0]
            if (subCode in subjectList) {
                subjectList[subCode].push(info)
            } else {
                subjectList[subCode] = [info]
            }
        }
    })
    console.log(subjectList)
    console.log("downloading")
}



