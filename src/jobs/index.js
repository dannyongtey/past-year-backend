import osmosis from 'osmosis'
import { loginOsmosis, downloadPaperForID } from '../controllers/utils'
import fs from 'fs'
import schedule from 'node-schedule'

const filePath = 'meta.json'
schedule.scheduleJob('00 * * * *', function () {
    scrapeAllInformation()
});

export async function scrapeAllInformation() {
    const { cookie, context } = await loginOsmosis()
    // console.log(cookie)
    // Fetch JSON list from file. Screw this, just scan everything again. I no time do.
    if (!fs.existsSync(filePath)) {
        const emptyObj = {}
        fs.writeFileSync(filePath, JSON.stringify(emptyObj))
    }
    // const subjectList = JSON.parse(fs.readFileSync(filePath))
    const subjectList = {} // Screw this, no time do. Just re scrap first
    const numbers = process.env.NODE_ENV === 'development' ? 500 : 99999
    const startFrom = 0
    let errorCount = 0
    // const url = `http://library.mmu.edu.my.proxyvlib.mmu.edu.my/library2/diglib/exam_col/tpimage.php?id=`
    const url = `http://library.mmu.edu.my/library2/diglib/exam_col/tpimage.php?id=`
    const searchPromises = () => Promise.all([...Array(numbers)].map((_, i) => {
        const id = 10000 + i + startFrom
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                const idURL = url + id.toString()
                const object = {}
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
                    .error((e) => { console.log(e); resolve(null); errorCount++; })
                    .debug(console.log)
                    .done(async () => {
                        if (!object['Title']) {
                            resolve(null)
                        } else {
                            const dl = object['Link']
                            object['ID'] = id
                            console.log(dl, id)
                            // console.log(object)
                            if (!fs.existsSync(`/tmp/${id}-${dl}.pdf`)) {
                                try {
                                    const { buffer } = await downloadPaperForID({ id: dl, context })
                                    fs.writeFile(`/tmp/${id}-${dl}.pdf`, buffer)
                                } catch (err) {
                                    console.log('error writing file', err)
                                }
                            }

                            try {
                                const trimmedSubject = (object['Subject'] || '').replace(' ', '')
                                object['Faculty'] = object['Faculty'].split(", Multimedia University")[0]
                                const rawSubjectCode = object['Title'].replace(' ', '').replace(trimmedSubject, '').replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, '')
                                const trimmedSubCode = rawSubjectCode.replace(/\s/g, '').toUpperCase()
                                const regex = /[A-Z]{3}[0-9]{4}/g
                                const subCode = trimmedSubCode.match(regex) ? trimmedSubCode.match(regex)[0] : trimmedSubCode
                                const filtered = {}
                                const whiteList = ['Faculty', 'Frequency', 'Year', 'Subject', 'ID']
                                whiteList.forEach(key => {
                                    filtered[key.replace(' ', '_').toLowerCase()] = object[key]
                                })
                                if (!subCode) console.log('somethign was wrong')
                                resolve({ [subCode]: filtered })
                            } catch (err) {
                                console.log(err)
                                resolve(null)
                            }
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
    const finalList = []
    Object.entries(subjectList).forEach(([subCode, info]) => {
        const newObj = {}
        newObj['code'] = subCode
        newObj['subject'] = info[0].subject || info[0].title || " "
        newObj['faculty'] = info[0].faculty
        newObj['papers'] = []
        info.forEach(obj => {
            newObj.papers.push({
                id: obj.id,
                sem: obj.frequency ? obj.frequency[obj.frequency.length - 1] : 0,
                year: obj.year
            })
        })
        newObj['papers'].sort((a, b) => {
            if (a.year > b.year) {
                return - 1
            } else if (b.year > a.year) {
                return 1
            } else {
                return 0
            }
        })
        finalList.push(newObj)
    })
    console.log(finalList)
    fs.writeFileSync(filePath, JSON.stringify(finalList))
    console.log("downloading")
}



