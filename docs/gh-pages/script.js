// Actualizar el año actual en el footer
document.getElementById('current-year').textContent = new Date().getFullYear();

// Animación de aparición al hacer scroll
document.addEventListener('DOMContentLoaded', function() {
  const animateOnScroll = function() {
    const elements = document.querySelectorAll('.feature-card, .step, .cta-box');
    
    elements.forEach(element => {
      const elementPosition = element.getBoundingClientRect().top;
      const screenPosition = window.innerHeight / 1.2;
      
      if (elementPosition < screenPosition) {
        element.style.opacity = '1';
        element.style.transform = 'translateY(0)';
      }
    });
  };
  
  // Aplicar estilos iniciales
  const elementsToAnimate = document.querySelectorAll('.feature-card, .step, .cta-box');
  elementsToAnimate.forEach(element => {
    element.style.opacity = '0';
    element.style.transform = 'translateY(20px)';
    element.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  });
  
  // Ejecutar la animación al cargar la página
  animateOnScroll();
  
  // Ejecutar la animación al hacer scroll
  window.addEventListener('scroll', animateOnScroll);
});

// Efecto de hover en los botones
// const buttons = document.querySelectorAll('.button');
// buttons.forEach(button => {
//   button.addEventListener('mouseenter', function() {
//     this.style.transform = 'translateY(-2px)';
//   });
  
//   button.addEventListener('mouseleave', function() {
//     this.style.transform = 'translateY(0)';
//   });
// });

// Navegación suave al hacer clic en enlaces internos
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    
    const targetId = this.getAttribute('href');
    const targetElement = document.querySelector(targetId);
    
    if (targetElement) {
      window.scrollTo({
        top: targetElement.offsetTop,
        behavior: 'smooth'
      });
    }
  });
});