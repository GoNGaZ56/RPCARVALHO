(function(){
    function $(id){ return document.getElementById(id); }
    const btnTema = $('btn-dark-mode');
    const btnMenu = $('btn-menu');
    const nav = $('site-nav');
    const tema = localStorage.getItem('rfTema') || 'light';
    if(tema === 'dark'){ document.body.classList.add('dark-theme'); }
    if(btnTema){
        btnTema.addEventListener('click', function(){
            document.body.classList.toggle('dark-theme');
            localStorage.setItem('rfTema', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
        });
    }
    if(btnMenu && nav){
        btnMenu.addEventListener('click', function(){ nav.classList.toggle('aberto'); });
        nav.querySelectorAll('a').forEach(function(a){ a.addEventListener('click', function(){ nav.classList.remove('aberto'); }); });
    }
})();
