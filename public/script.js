// ------------------------ Burger ------------------------

const burger = document.getElementById('burger');
const menu = document.getElementById('menu');

burger.addEventListener('click', () => {
    menu.classList.toggle('show');
});

// ------------------------ Pop-up ------------------------

const applicationModal = document.getElementById('application-modal');
const closeButton = document.querySelector('.close-button');
const openModalBtns = document.querySelectorAll('.open-modal-btn');
const applicationForm = document.getElementById('application-form');
const resumeUploadInput = document.getElementById('resume-upload');
const fileNameSpan = document.getElementById('file-name');
const uploadStatusDiv = document.getElementById('upload-status');
const jobTitleInput = document.getElementById('job-title-input');
const selectedJobTitleDisplay = document.getElementById('selected-job-title');

// Abrir o modal
openModalBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const jobTitle = btn.dataset.jobTitle; 
        selectedJobTitleDisplay.textContent = jobTitle;
        jobTitleInput.value = jobTitle;

        applicationModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    });
});

// Fechar o modal
closeButton.addEventListener('click', () => {
    applicationModal.style.display = 'none'; 
    document.body.style.overflow = ''; 
    // Limpar o formulário e status ao fechar
    applicationForm.reset();
    fileNameSpan.textContent = 'Nenhum arquivo selecionado';
    uploadStatusDiv.textContent = '';
});

// Fechar o modal clicando fora dele
window.addEventListener('click', (e) => {
    if (e.target === applicationModal) {
        applicationModal.style.display = 'none';
        document.body.style.overflow = '';
        // Limpar o formulário e status ao fechar
        applicationForm.reset();
        fileNameSpan.textContent = 'Nenhum arquivo selecionado';
        uploadStatusDiv.textContent = '';
    }
});

// Atualizar nome do arquivo selecionado
resumeUploadInput.addEventListener('change', () => {
    if (resumeUploadInput.files.length > 0) {
        fileNameSpan.textContent = resumeUploadInput.files[0].name;
    } else {
        fileNameSpan.textContent = 'Nenhum arquivo selecionado';
    }
});

// Submissão do formulário
applicationForm.addEventListener('submit', (e) => {
    e.preventDefault();

    if (resumeUploadInput.files.length === 0) {
        uploadStatusDiv.style.color = 'red';
        uploadStatusDiv.textContent = 'Por favor, selecione um arquivo PDF.';
        return;
    }

    const file = resumeUploadInput.files[0];
    if (file.type !== 'application/pdf') {
        uploadStatusDiv.style.color = 'red';
        uploadStatusDiv.textContent = 'Por favor, selecione um arquivo PDF válido.';
        return;
    }

    const formData = new FormData();
    formData.append('resume', file);
    formData.append('jobTitle', jobTitleInput.value);

    fetch('/api/upload-resume', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.message || 'Erro desconhecido ao enviar o arquivo.'); });
        }
        return response.json();
    })
    .then(data => {
        uploadStatusDiv.style.color = 'green';
        uploadStatusDiv.textContent = 'Currículo enviado com sucesso!';
        console.log('Upload bem-sucedido:', data);

    })
    .catch(error => {
        uploadStatusDiv.style.color = 'red';
        uploadStatusDiv.textContent = `Erro: ${error.message}`;
        console.error('Erro no upload:', error);
    });
});