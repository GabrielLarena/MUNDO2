// ---------- Navegação de botão ----------

const botoes = document.querySelectorAll('.btn-navegar');

botoes.forEach(botao => {
botao.addEventListener('click', () => {
    const paginaDestino = botao.getAttribute('data-pagina');

    window.location.href = paginaDestino;
    });
});

// ---------- Header ----------

const burger = document.getElementById('burger');
const menu = document.getElementById('menu');

burger.addEventListener('click', () => {
    menu.classList.toggle('show');
});
