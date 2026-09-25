// Applique le thème choisi AVANT l'affichage de la page (évite un clignotement).
// Fichier à part (et non "en ligne") car la politique de sécurité du site
// interdit les scripts écrits directement dans le HTML — c'est voulu, ça protège
// contre les attaques XSS. Voir server.js (Content-Security-Policy).
document.documentElement.dataset.theme = localStorage.getItem('theme') || 'dark';
