// import osmosis from 'osmosis'
import { promisify } from 'util';
import fs from 'fs'
import JSZip from 'jszip'
import { redisClient } from '../app'


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

export function readFromRedis(key) {
    return new Promise((resolve, reject) => {
        redisClient.get(key, (err, reply) => {
            if (reply) resolve(JSON.parse(reply))
            else resolve(reply)
        })
    })
}

export function saveToRedis(key, value) {
    redisClient.get(key, (err, reply) => {
        if (!reply) {
            redisClient.set(key, JSON.stringify(value))
        } else {
            throw new Error("ID already exists")
        }
    })
}

export async function getFileById(id) {
    const files = await readDirAsync(papersPath)
    for (const file of files) {
        if (file.split('.')[0] == id) {
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
            if (file.split('.')[0] == paper.id) {
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