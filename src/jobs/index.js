import cheerio from 'cheerio'
import axios from 'axios'

const link = 'http://library.mmu.edu.my/library2/diglib/exam_col/tpimage.php?id=10000'
const tableColumns = {
    'Collection Type': 'type',
    'Title': 'title',
    'Faculty': 'faculty',
    'Frequency': 'frequency',
    'Year': 'year',
    'Subject': 'subject',
}
const config = {
    headers: {
        "Host": "vlibcm.mmu.edu.my",
        "Connection": "keep-alive",
        "Content-Length": "8",
        "Cache-Control": "max-age=0",
        "Origin": "http://library.mmu.edu.my",
        "Upgrade-Insecure-Requests": "1",
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3",
        "Accept-Encoding": "gzip, deflate",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36"
    }
}
axios.get(link)
    .then((response) => {
        const info = {}
        const $ = cheerio.load(response.data)
        const pdfLink = $('input[name="xfile"]').attr("value")
        const downloadURL = `http://vlibcm.mmu.edu.my//xzamp/gxzam.php?action=${pdfLink}`
        const infoTable = $("table[cellpadding=5]")
        console.log(downloadURL)
        axios.post(downloadURL, {
            responseType: 'blob',
            
        }, config).then(response => {
            // response.data is an empty object
            console.log(response.data)
            // const blob = new Blob([response.data], {
            //     type: 'application/pdf',
            // });
            // console.log('testing')
            // console.log(blob)
        }).catch(err => console.log(err));
        // infoTable.find('tbody tr').each((_, element) => {
        //     const row = $(element).text()
        //     Object.entries(tableColumns).forEach(([column, key]) => {
        //         const possibleAnswers = row.split(column)
        //         if (possibleAnswers && possibleAnswers.length > 1) { // If > 1 means column and answer both available
        //             if (key === 'title') {
        //                 const rawCodeArray = possibleAnswers[1].split('-')
        //                 const rawCode = rawCodeArray[rawCodeArray.length - 1].replace(/\s/g, '')
        //                 const regex = /[A-Z]{3}[0-9]{4}/g
        //                 const subCode = rawCode.match(regex) ? rawCode.match(regex)[0] : 'undefined'
        //                 info['code'] = subCode
        //                 info[key] = possibleAnswers[1].trim()
        //             } else if (key === 'faculty') {
        //                 info[key] = possibleAnswers[1].split(", Multimedia University")[0].trim()
        //             } else {
        //                 info[key] = possibleAnswers[1].trim()
        //             }
        //         }
        //     })
        // })
        console.log(info)
        // console.log(info)
    }, (error) => console.log(err));
// import osmosis from 'osmosis'
// import { loginOsmosis, downloadPaperForID } from '../controllers/utils'
// import fs from 'fs'
// import schedule from 'node-schedule'

// const filePath = 'meta.json'
// const papersPath = process.env.storage_path || '/tmp'
// schedule.scheduleJob('00 * * * *', function () {
//     scrapeAllInformation()
// });

// export async function scrapeAllInformation() {
//     const { cookie, context } = await loginOsmosis()
//     // console.log(cookie)
//     // Fetch JSON list from file. Screw this, just scan everything again. I no time do.
//     if (!fs.existsSync(filePath)) {
//         const emptyObj = {}
//         fs.writeFileSync(filePath, JSON.stringify(emptyObj))
//     }
//     // const subjectList = JSON.parse(fs.readFileSync(filePath))
//     const subjectList = {} // Screw this, no time do. Just re scrap first
//     const numbers = process.env.NODE_ENV === 'development' ? 500 : 99999
//     const startFrom = 0
//     let errorCount = 0
//     // const url = `http://library.mmu.edu.my.proxyvlib.mmu.edu.my/library2/diglib/exam_col/tpimage.php?id=`
//     const url = `http://library.mmu.edu.my/library2/diglib/exam_col/tpimage.php?id=`
//     const searchPromises = () => Promise.all([...Array(numbers)].map((_, i) => {
//         const id = 10000 + i + startFrom
//         return new Promise((resolve, reject) => {
//             setTimeout(() => {
//                 const idURL = url + id.toString()
//                 const object = {}
//                 // osmosis.config('headers', { cookie })
//                 osmosis
//                     .get(idURL)
//                     .find('form')
//                     .set({
//                         'link': 'input[name="xfile"]@value'
//                     })
//                     .find('.smallcontent tr')
//                     .set({
//                         'column': 'td[1]',
//                         'value': 'td[2]',
//                     })
//                     .data(items => { object[items['column']] = items['value']; object['Link'] = items['link'].split('.pdf')[0]; })
//                     .log(console.log)
//                     .error((e) => { console.log(e); resolve(null); errorCount++; })
//                     .debug(console.log)
//                     .done(async () => {
//                         if (!object['Title']) {
//                             resolve(null)
//                         } else {
//                             const dl = object['Link']
//                             object['ID'] = id
//                             console.log(dl, id)
//                             // console.log(object)
//                             if (!fs.existsSync(`/tmp/${id}-${dl}.pdf`)) {
//                                 try {
//                                     const { buffer } = await downloadPaperForID({ id: dl, context })
//                                     fs.writeFile(`${papersPath}/${id}-${dl}.pdf`, buffer)
//                                 } catch (err) {
//                                     console.log('error writing file', err)
//                                 }
//                             }

//                             try {
//                                 const trimmedSubject = (object['Subject'] || '').replace(' ', '')
//                                 object['Faculty'] = object['Faculty'].split(", Multimedia University")[0]
//                                 const rawSubjectCode = object['Title'].replace(' ', '').replace(trimmedSubject, '').replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, '')
//                                 const trimmedSubCode = rawSubjectCode.replace(/\s/g, '').toUpperCase()
//                                 const regex = /[A-Z]{3}[0-9]{4}/g
//                                 const subCode = trimmedSubCode.match(regex) ? trimmedSubCode.match(regex)[0] : trimmedSubCode
//                                 const filtered = {}
//                                 const whiteList = ['Faculty', 'Frequency', 'Year', 'Subject', 'ID']
//                                 whiteList.forEach(key => {
//                                     filtered[key.replace(' ', '_').toLowerCase()] = object[key]
//                                 })
//                                 if (!subCode) console.log('somethign was wrong')
//                                 resolve({ [subCode]: filtered })
//                             } catch (err) {
//                                 console.log(err)
//                                 resolve(null)
//                             }
//                         }
//                     })
//             }, i * 15)


//         })
//     }))

//     const results = await searchPromises()
//     results.forEach(result => {
//         if (result) {
//             const subCode = Object.keys(result)[0]
//             const info = Object.values(result)[0]
//             if (subCode in subjectList) {
//                 subjectList[subCode].push(info)
//             } else {
//                 subjectList[subCode] = [info]
//             }
//         }
//     })
//     console.log(subjectList)
//     const finalList = []
//     Object.entries(subjectList).forEach(([subCode, info]) => {
//         const newObj = {}
//         newObj['code'] = subCode
//         newObj['subject'] = info[0].subject || info[0].title || null
//         newObj['faculty'] = info[0].faculty
//         newObj['papers'] = []
//         info.forEach(obj => {
//             newObj.papers.push({
//                 id: obj.id,
//                 // sem: obj.frequency ? isNaN(obj.frequency[obj.frequency.length - 1])? '-': obj.frequency[obj.frequency.length - 1] : '-',
//                 sem: obj.frequency || 'unknown',
//                 year: obj.year
//             })
//         })
//         newObj['papers'].sort((a, b) => {
//             if (a.year > b.year) {
//                 return - 1
//             } else if (b.year > a.year) {
//                 return 1
//             } else {
//                 return 0
//             }
//         })
//         finalList.push(newObj)
//     })
//     console.log(finalList)
//     fs.writeFileSync(filePath, JSON.stringify(finalList))
//     console.log("downloading")
// }



