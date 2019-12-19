// import osmosis from 'osmosis'
import { promisify } from 'util';
import fs from 'fs'
import JSZip from 'jszip'

const papersPath = process.env.storage_path || '/tmp'

const readFileAsync = promisify(fs.readFile)
const readDirAsync = promisify(fs.readdir)

export function formatSubject(sub) {
    const noSpace = sub.replace(/\s/g, '')
    return noSpace.slice(0, 3) + noSpace.slice(3)
}

export function isValidSubject(sub) {
    const noSpace = sub.replace(/\s/g, '')
    return pattern.test(noSpace)
}

export async function getFileById(id) {
    const files = await readDirAsync(papersPath)
    for (const file of files) {
        if (file.split('-')[0] == id) {
            // File found
            const buffer = await readFileAsync(`${papersPath}/${file}`)
            return new Buffer(buffer)
        }
    }
}

export async function getFilesBySubject(subCode) {
    const subjectCode = formatSubject(subCode)
    const records = JSON.parse(fs.readFileSync("meta.json"))
    const files = await readDirAsync(papersPath)
    const record = records.find(record => record.code == subjectCode)
    if (!record) throw new Error("No paper found")
    const papers = []
    for (const paper of record.papers) {
        for (const file of files) {
            if (file.split('-')[0] == paper.id) {
                // File found
                
                const buffer = await readFileAsync(`${papersPath}/${file}`)
                papers.push({ buffer: new Buffer(buffer), id: paper.id })
            }
        }
    }
    return papers
}

export async function getFilesBySubjects(subjects) {
    let zip = new JSZip()
    for (const subject of subjects) {
        const papers = await getFilesBySubject(subject)
        const folder = zip.folder(subject)
        for (const paper of papers) {
            const { id, buffer } = paper
            folder.file(`${id}.pdf`, buffer)
        }
    }

    const zipFile = await zip.generateAsync({ type: "nodebuffer" })
    return zipFile
}

export async function zip(files) {
    let zip = new JSZip()
    files.forEach(file => {
        zip.file(`${file.id}.pdf`, file.buffer)
    })
    const zipFile = await zip.generateAsync({ type: "nodebuffer" })
    return zipFile
}

// export function urlFor(code) {
//     const formattedSubject = formatSubject(code)
//     const subjectParts = formattedSubject.split(' ')
//     const search_url
//         = `http://library.mmu.edu.my.proxyvlib.mmu.edu.my/library2/diglib/exam_col/resindex.php?df1=title&rt=${subjectParts[0]}%20${subjectParts[1]}&ph1=%&cmp1=&df2=&ra=&ph2=&cmp2=&ri=&rp=&rf=&ry1=&ry2=&df3=title&std=ASC&page=0&limit=50`
//     return search_url
// }

// export function isLoggedIn(cookie) {
//     if (!cookie) return Promise.resolve(false)
//     const testURL = urlFor('TSN 1101')
//     let debugLog = ''
//     osmosis.config('headers', { cookie })
//     return new Promise((resolve, reject) => {
//         let isloggedin
//         osmosis
//             .get(testURL)
//             .log(result => debugLog += result)
//             .done(() => {
//                 if (debugLog.includes('login?url')) {
//                     isloggedin = false
//                 } else {
//                     isloggedin = true
//                 }
//                 resolve(isloggedin)
//             })
//     }).then((status) => {
//         return status
//     })


// }

// export function loginOsmosis() {
//     const loginURL = 'https://proxyvlib.mmu.edu.my/login'

//     const { student_id, student_password } = process.env
//     return new Promise((resolve, reject) => {
//         return new Promise((res, rej) => {
//             osmosis
//                 .get(loginURL)
//                 .then(function (context, data, next) {
//                     res({ context, cookie: context.request.headers.cookie })
//                 })
//         }).then(({ context, cookie }) => {
//             isLoggedIn(cookie).then(hasLoggedIn => {
//                 if (hasLoggedIn) {
//                     resolve({ context, cookie })
//                 } else {
//                     osmosis
//                         .get(loginURL)
//                         .login(student_id, student_password)
//                         .then(function (context, data, next) {
//                             resolve({ context, cookie: context.request.headers.cookie })
//                         })
//                         .log(console.log)
//                         .error(console.log)
//                         .debug(console.log)
//                 }
//             })
//         })
//     })
// }

// export function extractSubjectDataFrom({ url, cookie }) {
//     return new Promise((resolve, reject) => {
//         let objects = {}
//         osmosis.config('headers', { cookie })
//         osmosis
//             .get(url)
//             .find('.resultcontent > table > tr > td a')
//             .set({
//                 item: ' :html',
//             })
//             .data(items => { objects = items; })
//             .log(console.log)
//             .error(console.log)
//             .debug(console.log)
//             .done(() => resolve(objects))
//     }).then((items) => {
//         const rawSubjectString = Object.values(items).join('')
//         return extractDataFrom(rawSubjectString)
//     })

// }

// export function downloadPaperForID({ id, context }) {
//     const url = `http://vlibcm.mmu.edu.my//xzamp/gxzam.php?action=${id}.pdf`
//     // const url = `http://vlibcm.mmu.edu.my.proxyvlib.mmu.edu.my//xzamp/gxzam.php?action=${id}.pdf`
//     return new Promise((resolve, reject) => {
//         try {
//             osmosis
//                 // .get(url)
//                 .then(function (_, __, next) {
//                     this.request('post', context, url, null, function (err, res, buffer) {
//                         if (!buffer) reject()
//                         resolve({ id, buffer })
//                         next()
//                     })
//                 })
//                 .log(console.log)
//                 .error(console.log)
//                 .debug(console.log)
//         } catch (err) {
//             reject(err)
//         }

//     })
// }

// function extractDataFrom(str) {
//     const regex = /tabstract.php\?id=(.+)<br>/gi
//     const rawMatches = str.match(regex)
//     const subjectInfo = []
//     if (!rawMatches) return subjectInfo
//     rawMatches.forEach(match => {
//         const splitedID = match.replace('tabstract.php?id=', '').split('" title=')
//         const splitedSubName = splitedID[1].replace('"More details">', '').split('</a> <b>')
//         const splitedFaculty = splitedSubName[1].split('</b> <i>')
//         const trimester = splitedFaculty[1].replace('</i>', '').replace('<br>', '').trim()
//         subjectInfo.push({
//             id: splitedID[0],
//             subjectName: splitedSubName[0],
//             subjectFaculty: splitedFaculty[0],
//             trimester,
//         })
//     })
//     return subjectInfo
// }