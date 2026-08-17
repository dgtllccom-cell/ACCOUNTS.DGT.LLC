// ==========================================================================
// Digital Dock ERP - Purchase Form Interactive Controller
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
});

// State
const filterState = {
  country: 'All',
  branch: 'All',
  status: 'All',
  searchQuery: '',
  activeTab: 'detailed'
};

function initEventListeners() {
  // Close open dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-select-wrapper')) {
      closeAllDropdowns();
    }
  });
}

// Dropdown Toggling
function toggleDropdown(menuId) {
  const targetMenu = document.getElementById(menuId);
  const isOpen = targetMenu.classList.contains('show');
  closeAllDropdowns();
  if (!isOpen) {
    targetMenu.classList.add('show');
  }
}

function closeAllDropdowns() {
  document.querySelectorAll('.dropdown-menu').forEach(menu => {
    menu.classList.remove('show');
  });
}

// Filter Selection Handler
function selectFilter(type, value, label) {
  filterState[type] = value;
  
  if (type === 'country') {
    document.getElementById('countryLabel').textContent = label;
  } else if (type === 'branch') {
    document.getElementById('branchLabel').textContent = label;
  } else if (type === 'status') {
    document.getElementById('statusLabel').textContent = label;
  }

  // Update active dropdown item state
  const menuId = `${type}Menu`;
  const menu = document.getElementById(menuId);
  if (menu) {
    menu.querySelectorAll('.dropdown-item').forEach(item => {
      item.classList.toggle('active', item.textContent.trim().toLowerCase() === value.toLowerCase() || (value === 'All' && item.textContent.includes('All')));
    });
  }

  closeAllDropdowns();
  applyFilters();
}

// Search Input Handler
function handleSearch() {
  const input = document.getElementById('searchInput');
  filterState.searchQuery = input.value.trim().toLowerCase();
  applyFilters();
}

// Apply Filters to Table Rows
function applyFilters() {
  const rows = document.querySelectorAll('#tableBody tr');
  let visibleCount = 0;

  rows.forEach(row => {
    const rowCountry = (row.getAttribute('data-country') || '').toLowerCase();
    const rowBranch = (row.getAttribute('data-branch') || '').toLowerCase();
    const rowStatus = (row.getAttribute('data-status') || '').toLowerCase();
    const rowText = row.textContent.toLowerCase();

    const matchesCountry = filterState.country === 'All' || rowCountry === filterState.country.toLowerCase();
    const matchesBranch = filterState.branch === 'All' || rowBranch === filterState.branch.toLowerCase();
    const matchesStatus = filterState.status === 'All' || rowStatus === filterState.status.toLowerCase();
    const matchesSearch = !filterState.searchQuery || rowText.includes(filterState.searchQuery);

    if (matchesCountry && matchesBranch && matchesStatus && matchesSearch) {
      row.style.display = '';
      visibleCount++;
    } else {
      row.style.display = 'none';
    }
  });

  const noResultsMsg = document.getElementById('noResultsMessage');
  if (noResultsMsg) {
    noResultsMsg.style.display = visibleCount === 0 ? 'block' : 'none';
  }
}

// Reset Filters & Search
function resetFilters() {
  filterState.country = 'All';
  filterState.branch = 'All';
  filterState.status = 'All';
  filterState.searchQuery = '';

  document.getElementById('countryLabel').textContent = 'Select Country (All)';
  document.getElementById('branchLabel').textContent = 'Select Branch (All)';
  document.getElementById('statusLabel').textContent = 'Select Status (All)';
  
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';

  closeAllDropdowns();
  applyFilters();
}

// Tab Switching
function switchTab(tabType) {
  filterState.activeTab = tabType;
  const tabStandard = document.getElementById('tabStandard');
  const tabDetailed = document.getElementById('tabDetailed');

  if (tabType === 'standard') {
    tabStandard.classList.add('active');
    tabDetailed.classList.remove('active');
  } else {
    tabDetailed.classList.add('active');
    tabStandard.classList.remove('active');
  }
}

// Back Button Navigation
function handleBack() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    alert('Returning to previous dashboard view...');
  }
}

// + New Booking Button Handler
function handleNewBooking() {
  alert('Opening New Purchase Booking Form...');
}
