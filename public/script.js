// ------------------------ Burger ------------------------

const burger = document.getElementById('burger');
const menu = document.getElementById('menu');

burger.addEventListener('click', () => {
    menu.classList.toggle('show');
});

// ------------------------ Pop-up ------------------------

const applicationModal = document.getElementById('application-modal');
const closeButton = document.querySelector('.close-button');
const openModalBtns = document.querySelectorAll('.open-modal-btn'); // Seleciona todos os botões "Inscrever-se"
const applicationForm = document.getElementById('application-form');
const resumeUploadInput = document.getElementById('resume-upload');
const fileNameSpan = document.getElementById('file-name');
const uploadStatusDiv = document.getElementById('upload-status');

// Abrir o modal
openModalBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault(); // Impede o comportamento padrão do link (ir para '#')
        applicationModal.style.display = 'flex'; // Exibe o modal (usando flex para centralizar)
        document.body.style.overflow = 'hidden'; // Impede o scroll do corpo da página
    });
});

// Fechar o modal
closeButton.addEventListener('click', () => {
    applicationModal.style.display = 'none'; // Esconde o modal
    document.body.style.overflow = ''; // Restaura o scroll do corpo da página
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

// Atualizar o nome do arquivo selecionado
resumeUploadInput.addEventListener('change', () => {
    if (resumeUploadInput.files.length > 0) {
        fileNameSpan.textContent = resumeUploadInput.files[0].name;
    } else {
        fileNameSpan.textContent = 'Nenhum arquivo selecionado';
    }
});

// Submissão do formulário (teste)
applicationForm.addEventListener('submit', (e) => {
    e.preventDefault(); // Impede o envio padrão do formulário

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

    // Aqui você enviaria o arquivo para o seu backend
    uploadStatusDiv.style.color = 'green';
    uploadStatusDiv.textContent = `Currículo "${file.name}" enviado com sucesso (simulado)!`;

    const formData = new FormData();
    formData.append('resume', file);

    fetch('/api/upload-resume', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Erro ao enviar o arquivo.');
        }
        return response.json();
    })
    .then(data => {
        uploadStatusDiv.style.color = 'green';
        uploadStatusDiv.textContent = 'Currículo enviado com sucesso!';
        console.log('Upload bem-sucedido:', data);
        // Opcional: fechar o modal após um pequeno atraso
        setTimeout(() => {
            closeButton.click();
        }, 2000);
    })
    .catch(error => {
        uploadStatusDiv.style.color = 'red';
        uploadStatusDiv.textContent = `Erro: ${error.message}`;
        console.error('Erro no upload:', error);
    });

});