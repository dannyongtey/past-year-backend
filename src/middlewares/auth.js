import { OAuth2Client } from 'google-auth-library'

const GOOGLE_CLIENT_ID = process.env.google_client_id
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

export default async function (req, res, next) {
    if (req.method !== 'OPTIONS') {
        const authHeader = JSON.parse(req.header('authorization').split('Bearer ')[1])
        const { tokenId } = authHeader
        try {
            const ticket = await client.verifyIdToken({
                idToken: tokenId,
                audience: GOOGLE_CLIENT_ID,
            });
            const payload = ticket.getPayload();
            if (payload['hd'] !== 'student.mmu.edu.my'){
                res.status(401).json({error: 'Unauthorized. Please use MMU student email to login.'})
                return
            } else {
                next()
            }
        } catch {
            res.status(401).json({error: 'Unauthorized. Please ensure you are logged in using official MMU Account.'})
            return
        }
    } else {
        next()
    }

}