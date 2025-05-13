const express = require('express')
const app = express()
const PORT = process.env.PORT || 3000;

// Static files
app.use(express.static('public'))

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`)
})
