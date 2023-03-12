import app from './api/index.js';

const PORT = 5000;

app.listen(PORT, () =>{
    console.log(`Server is running on port ${PORT}.`)
})