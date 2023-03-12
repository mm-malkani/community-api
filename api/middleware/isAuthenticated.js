import admin from '../utils/firebaseUtil.js'

function isAuthenticated(req, res, next)
{
    const authorization = req.headers.authorization

    if(!authorization)
    {
        return res.status(401).send({ message: 'Unauthorized no authorization found' })
    }
    
    if(!authorization.startsWith('Bearer'))
    {
        return res.status(401).send({ message: 'Unauthorized no bearer found' })
    }

    const split = authorization.split('Bearer ')

    if (split.length !== 2)
    {
        return res.status(401).send({ message: 'Unauthorized no token found' })
    }

    admin.auth()
        .verifyIdToken(split[1])
        .then((decodedToken) => 
        {
            req.userid = decodedToken.uid
            return next()
        })
        .catch((error) => 
        {
            return res.status(401).send({ message: 'Unauthorized couldn\'t authorize' })
        })

}

export { isAuthenticated }
