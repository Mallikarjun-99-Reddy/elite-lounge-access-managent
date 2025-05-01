document.addEventListener('DOMContentLoaded', () => {
    const checkinForm = document.getElementById('checkinForm');
    const messageDiv = document.getElementById('message');
    const visitDateInput = document.getElementById('visitDate');

    // Set minimum date to today
    visitDateInput.min = new Date().toISOString().split('T')[0];

    checkinForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const checkinData = {
            name: document.getElementById('name').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            accessMethod: document.getElementById('accessMethod').value,
            visitDate: document.getElementById('visitDate').value
        };

        // Client-side validation
        if (!checkinData.name || !checkinData.email || !checkinData.phone || !checkinData.accessMethod || !checkinData.visitDate) {
            messageDiv.textContent = 'Please fill in all fields.';
            messageDiv.style.color = '#ff4444';
            return;
        }

        try {
            const response = await fetch('/api/checkin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(checkinData)
            });

            const result = await response.json();
            if (response.ok) {
                messageDiv.textContent = result.message || 'Check-in successful! Redirecting...';
                messageDiv.style.color = '#f5c107';
                setTimeout(() => {
                    window.location.href = `/lounge.html?visitorId=${result.visitorId}`;
                }, 1500);
            } else {
                messageDiv.textContent = result.message || 'Error checking in. Please try again.';
                messageDiv.style.color = '#ff4444';
            }
        } catch (err) {
            console.error('Check-In Fetch Error:', err);
            messageDiv.textContent = 'Network error. Please check your connection or server status.';
            messageDiv.style.color = '#ff4444';
        }
    });
});