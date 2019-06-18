import osmosis from 'osmosis'

export function formatSubject(sub) {
    const noSpace = sub.replace(/\s/g, '')
    return noSpace.slice(0, 3) + ' ' + noSpace.slice(3)
}

export function isValidSubject(sub) {
    const noSpace = sub.replace(/\s/g, '')
    return pattern.test(noSpace)
}

export function urlFor(code) {
    const subjectParts = code.split(' ')
    const search_url
        = `http://library.mmu.edu.my.proxyvlib.mmu.edu.my/library2/diglib/exam_col/resindex.php?df1=title&rt=${subjectParts[0]}%20${subjectParts[1]}&ph1=%&cmp1=&df2=&ra=&ph2=&cmp2=&ri=&rp=&rf=&ry1=&ry2=&df3=title&std=ASC&page=0&limit=50`
    return search_url
}

export function isLoggedIn(cookie) {
    const testURL = urlFor('TSN 1101')
    let debugLog = ''
    osmosis.config('headers', { cookie })
    return new Promise((resolve, reject) => {
        let isloggedin
        osmosis
            .get(testURL)
            .log(result => debugLog += result)
            .done(() => {
                if (debugLog.includes('login?url')) {
                    isloggedin = false
                } else {
                    isloggedin = true
                }
                resolve(isloggedin)
            })
    }).then((status) => {
        return status
    })


}

export function loginOsmosis() {
    const loginURL = 'https://proxyvlib.mmu.edu.my/login'

    const {student_id, student_password} = process.env
    return new Promise((resolve, reject) => {
        osmosis
            .get(loginURL)
            .login(student_id, student_password)
            .then(function (context, data, next) {
                resolve(context)
            })
            .log(console.log)
            .error(console.log)
            .debug(console.log)


    })
}

export function extractSubjectDataFrom({ url, cookie }) {
    return new Promise((resolve, reject) => {
        let objects = {}
        osmosis.config('headers', { cookie })
        osmosis
            .get(url)
            .find('.resultcontent > table > tr > td a')
            .set({
                item: ' :html',
            })
            .data(items => { objects = items; })
            .log(console.log)
            .error(console.log)
            .debug(console.log)
            .done(() => resolve(objects))
    }).then((items) => {
        const rawSubjectString = Object.values(items).join('')
        return extractDataFrom(rawSubjectString)
    })

}

export function downloadPaperForID({ id, context }) {
    const url = `http://vlibcm.mmu.edu.my.proxyvlib.mmu.edu.my//xzamp/gxzam.php?action=${id}.pdf`
    return new Promise((resolve, reject) => {
        osmosis
            .get(url)
            .then(function (_, __, next) {
                this.request('post', context, url, null, function (err, res, buffer) {
                    resolve(buffer)
                    next()
                })
            })
            .log(console.log)
            .error(console.log)
            .debug(console.log)
    })
}

function extractDataFrom(str) {
    const regex = /tabstract.php\?id=(.+)<br>/gi
    const rawMatches = str.match(regex)
    const subjectInfo = []
    rawMatches.forEach(match => {
        console.log(match)
        const splitedID = match.replace('tabstract.php?id=', '').split('" title=')
        const splitedSubName = splitedID[1].replace('"More details">', '').split('</a> <b>')
        const splitedFaculty = splitedSubName[1].split('</b> <i>')
        const trimester = splitedFaculty[1].replace('</i>', '').replace('<br>', '').trim()
        subjectInfo.push({
            id: splitedID[0],
            subjectName: splitedSubName[0],
            subjectFaculty: splitedFaculty[0],
            trimester,
        })
    })
    return subjectInfo
}