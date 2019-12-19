import cheerio from 'cheerio'
import axios from 'axios'
import FormData from 'form-data'
import fs from 'fs'
import schedule from 'node-schedule'

const filePath = 'meta.json'
const papersPath = process.env.storage_path || '/tmp'
schedule.scheduleJob('53 * * * *', function () {
    console.log('Scraping papers')
    scrapeAllInformation()
});

export async function scrapeAllInformation() {
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
            "Referer": "http://library.mmu.edu.my/library2/diglib/exam_col/tvalidate.php",
            "Connection": "keep-alive",
            "Content-Length": "8",
            "Cache-Control": "max-age=0",
            "Origin": "http://library.mmu.edu.my",
            "Upgrade-Insecure-Requests": "1",
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3",
            "Accept-Encoding": "gzip, deflate",
            "Accept-Language": "en-US,en;q=0.9",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36",
            "Cookie": "_ga=GA1.3.196964147.1560215500; ezproxy=kr8ZxOtxzSxfGFa"
        },
        responseType: 'arraybuffer'
    }
    const bodyFormData = new FormData();
    bodyFormData.append("x", 9)
    bodyFormData.append("y", 13)
    // Fetch JSON list from file. Screw this, just scan everything again. I no time do.
    if (!fs.existsSync(filePath)) {
        const emptyObj = {}
        fs.writeFileSync(filePath, JSON.stringify(emptyObj))
    }
    // const subjectList = JSON.parse(fs.readFileSync(filePath))
    const subjectList = {} // Screw this, no time do. Just re scrap first
    const finalList = []
    const numbers = process.env.NODE_ENV === 'development' ? 10 : 99999
    const startFrom = 0
    const searchPromises = () => Promise.all([...Array(numbers)].map((_, i) => {
        return new Promise((resolve, reject) => {
            const id = 10000 + i + startFrom
            setTimeout(() => {
                const link = `http://library.mmu.edu.my/library2/diglib/exam_col/tpimage.php?id=${id}`
                axios.get(link)
                    .then(async (response) => {
                        const info = {}
                        const $ = cheerio.load(response.data)
                        const pdfLink = $('input[name="xfile"]').attr("value")
                        const downloadURL = `http://vlibcm.mmu.edu.my//xzamp/gxzam.php?action=${pdfLink}`
                        const infoTable = $("table[cellpadding=5]")
                        if (!fs.existsSync(`/tmp/${id}-${pdfLink}`)) {
                            try {
                                const res = await axios.post(downloadURL, {}, config)
                                const buffer = new Buffer(res.data)
                                fs.writeFileSync(`${papersPath}/${id}-${pdfLink}`, buffer)
                            } catch (err) {
                                console.log('error writing file', err)
                            }
                        }
                        info['id'] = id
                        infoTable.find('tbody tr').each((_, element) => {
                            const row = $(element).text()
                            Object.entries(tableColumns).forEach(([column, key]) => {
                                const possibleAnswers = row.replace(column, "")
                                if (possibleAnswers.length != row.length) {
                                    // if (possibleAnswers && possibleAnswers.length > 1) { // If > 1 means column and answer both available
                                    if (key === 'title') {
                                        const rawCodeArray = possibleAnswers.split('-')
                                        const rawCode = rawCodeArray[rawCodeArray.length - 1].replace(/\s/g, '')
                                        const regex = /[A-Z]{3}[0-9]{4}/g
                                        const subCode = rawCode.match(regex) ? rawCode.match(regex)[0] : 'undefined'
                                        info['code'] = subCode
                                        info['subject'] = possibleAnswers.trim()
                                    } else if (key === 'faculty') {
                                        info[key] = possibleAnswers.split(", Multimedia University")[0].trim()
                                    } else {
                                        info[key] = possibleAnswers.trim()
                                    }
                                }
                            })
                        })
                        resolve(info)
                    }, (error) => reject(err));
            }, i * 15)
        })
    }))
    const results = await searchPromises()
    results.forEach(result => {
        if (result) {
            const subCode = result['code']
            if (subCode) {
                const info = result
                delete result['code']
                if (subCode in subjectList) {
                    subjectList[subCode].push(info)
                } else {
                    subjectList[subCode] = [info]
                }
            }
        }
    })
    Object.entries(subjectList).forEach(([subCode, info]) => {
        const newObj = {}
        newObj['code'] = subCode
        newObj['subject'] = info[0].subject || info[0].title || null
        newObj['faculty'] = info[0].faculty
        newObj['papers'] = []
        info.forEach(obj => {
            newObj.papers.push({
                id: obj.id,
                // sem: obj.frequency ? isNaN(obj.frequency[obj.frequency.length - 1])? '-': obj.frequency[obj.frequency.length - 1] : '-',
                sem: obj.frequency || 'unknown',
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
    fs.writeFileSync(filePath, JSON.stringify(finalList))

}



