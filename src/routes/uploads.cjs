const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads', 'resumes');

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {

        // NOME GENERICO TEMPORÁRIO
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${fileExtension}`);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        
        req.fileValidationError = 'Apenas arquivos PDF são permitidos!';
        cb(null, false);
    }
};


const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // Limite de 5MB
    }
});

router.post('/', upload.single('resume'), (req, res, next) => {
    console.log('Requisição de upload recebida!');
    console.log('Vaga de emprego recebida (req.body.jobTitle):', req.body.jobTitle);

    if (req.file) {
        const jobTitle = req.body.jobTitle;
        const oldPath = req.file.path; 
        const fileExtension = path.extname(req.file.originalname);

        const jobTitleSafe = jobTitle ? jobTitle.replace(/[^a-zA-Z0-9_]/g, '') : 'vaga_nao_especificada';
        const newFilename = `${jobTitleSafe}-${req.file.fieldname}-${Date.now()}${fileExtension}`;
        const newPath = path.join(UPLOADS_DIR, newFilename);

        fs.rename(oldPath, newPath, (err) => {
            if (err) {
                console.error('Erro ao renomear o arquivo:', err);
              
                fs.unlink(oldPath, (unlinkErr) => {
                    if (unlinkErr) console.error('Erro ao remover arquivo temporário após falha na renomeação:', unlinkErr);
                });
                return res.status(500).json({ message: 'Erro ao processar o arquivo.', error: err.message });
            }

            console.log(`Currículo para a vaga "${jobTitle}" recebido: ${newFilename}`);
            res.status(200).json({
                message: 'Currículo enviado com sucesso!',
                filename: newFilename,
                filepath: `/uploads/resumes/${newFilename}`,
                jobTitle: jobTitle
            });
        });

    } else {
        
        if (req.fileValidationError) {
            return res.status(400).json({ message: req.fileValidationError });
        }
        res.status(400).json({ message: 'Nenhum arquivo de currículo enviado ou arquivo inválido.' });
    }
}, (error, req, res, next) => {
    // Middleware de tratamento de erro do Multer
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'O arquivo é muito grande. Tamanho máximo permitido é 5MB.' });
        }
        return res.status(400).json({ message: error.message });
    }
    if (error) {
        return res.status(400).json({ message: error.message });
    }
    next(error);
});

module.exports = router;