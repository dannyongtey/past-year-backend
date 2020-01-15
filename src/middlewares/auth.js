import { OAuth2Client } from 'google-auth-library'

const GOOGLE_CLIENT_ID = process.env.google_client_id
const client = new OAuth2Client(GOOGLE_CLIENT_ID);
import axios from 'axios'
import { redisClient } from '../app'
import jwtDecode from 'jwt-decode'

export async function mmlsAuth (req, res, next) {
    let link = `https://mmumobileapps.mmu.edu.my/api/userdetails?token=`
    try {
        const { token } = req.query

        if (!token) return next()
        redisClient.get(token, async (err, reply) => {
            const value = JSON.parse(reply)
            if (!value) {
                link += token
                try {
                    const { data } = await axios.get(link)
                    redisClient.set(token, JSON.stringify(data))
                    next()
                } catch (err) {
                    res.status(403).json({ error: 'Invalid token.' })
                }

            } else {
                // Check token validity
                const { exp } = jwtDecode(token) // EXP in javascript need multiple 1000
                const expiry = new Date(exp * 1000)
                if (new Date() > expiry) {
                    res.status(403).json({ error: 'Token expired. Please re-login' })
                } else {
                    res.locals.authorized = true
                    next()
                }
            }
        })



    } catch (err) {
        // console.log(err.response.data)
        res.status(403).json({ error: err.response ? err.response.data : 'Unauthorized. Please provide correct token.' })
    }

    // next()
}

export async function googleAuth (req, res, next) {
    if (req.method !== 'OPTIONS' && !res.locals.authorized) {
        try {
            const authHeader = JSON.parse(req.header('authorization').split('Bearer ')[1])
            const { tokenId } = authHeader
            const ticket = await client.verifyIdToken({
                idToken: tokenId,
                audience: GOOGLE_CLIENT_ID,
            });
            const payload = ticket.getPayload();
            if (payload['hd'] !== 'student.mmu.edu.my') {
                res.status(403).json({ error: 'Unauthorized. Please provide correct credentials.' })
                return
            } else {
                next()
            }
        } catch {
            res.status(403).json({ error: 'Unauthorized. Please provide correct credentials.' })
            return
        }
    } else {
        next()
    }

}