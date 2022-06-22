import express from 'express';

const app = express();

app.get('/', (request, response) => {
    return response.json({ mensage: 'e ai carinhasdasda asd ali' })
})
console.log("http://localhost:3333")

app.listen(3333);