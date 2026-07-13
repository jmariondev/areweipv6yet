document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search');
  const filterButtons = document.querySelectorAll('.filter-btn');
  const services = document.querySelectorAll('.service-card');
  
  let currentFilter = 'all';
  
  // Filter functionality
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      applyFilters();
    });
  });
  
  // Search functionality
  searchInput.addEventListener('input', applyFilters);
  
  function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase();
    
    services.forEach(card => {
      const matchesFilter = currentFilter === 'all' || 
        card.classList.contains(`status-${currentFilter}`);
      
      const text = card.textContent.toLowerCase();
      const matchesSearch = searchTerm === '' || text.includes(searchTerm);
      
      if (matchesFilter && matchesSearch) {
        card.classList.remove('hidden');
      } else {
        card.classList.add('hidden');
      }
    });
  }
  
});