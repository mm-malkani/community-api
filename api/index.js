import express, { json, urlencoded } from 'express'
const app = express()

app.set('view engine', 'ejs')
app.use(json())
app.use(urlencoded({ extended: false }))

import usersRouter from './users/users.routes.js'
app.use('/users', usersRouter)

import postsRouter from './posts/posts.routes.js'
app.use('/posts', postsRouter)

import groupsRouter from './groups/groups.routes.js'
app.use('/groups', groupsRouter)


app.put('/authTokenSet', async (req, res) => 
{
    res.status(200).send("Auth token set as {{AUTH_TOKEN}} env variable in Postman")
})

export default app;