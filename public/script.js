document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search');
  const filterButtons = document.querySelectorAll('.filter-btn');
  const rows = document.querySelectorAll('tr.service-row');
  const groups = document.querySelectorAll('tbody.group');
  const counter = document.querySelector('.filter-count');
  const total = rows.length;

  let currentFilter = 'all';

  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      applyFilters();
    });
  });

  searchInput.addEventListener('input', applyFilters);

  function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase();
    let shown = 0;

    rows.forEach((row) => {
      const matchesFilter = currentFilter === 'all' || row.dataset.status === currentFilter;
      const matchesSearch = searchTerm === '' || row.textContent.toLowerCase().includes(searchTerm);
      const visible = matchesFilter && matchesSearch;
      row.classList.toggle('hidden', !visible);
      if (visible) shown += 1;
    });

    // A group whose rows are all filtered out takes its header with it.
    groups.forEach((group) => {
      const empty = !group.querySelector('tr.service-row:not(.hidden)');
      group.querySelector('.group-row').classList.toggle('hidden', empty);
    });

    counter.textContent = shown === total ? `${total} services` : `${shown} of ${total} shown`;
  }
});
