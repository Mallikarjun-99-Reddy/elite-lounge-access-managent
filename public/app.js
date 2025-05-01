document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const visitorId = urlParams.get('visitorId');
    let timeLeft = 120;

    const timerDisplay = document.getElementById('timer');
    const extendBtn = document.getElementById('extendBtn');
    const paymentSection = document.getElementById('paymentSection');
    const payBtn = document.getElementById('payBtn');
    const paymentMessage = document.getElementById('paymentMessage');
    const addButtons = document.querySelectorAll('.add-btn');
    const popup = document.getElementById('popup');
    const adsList = document.getElementById('adsList');

    if (!visitorId) {
        timerDisplay.textContent = 'Error: No visitor ID found. Please check in first.';
        timerDisplay.style.color = '#ff4444';
        extendBtn.disabled = true;
        addButtons.forEach(btn => btn.disabled = true);
        return;
    }

    const countdown = setInterval(() => {
        timeLeft--;
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerDisplay.textContent = `Time Remaining: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        if (timeLeft <= 0) {
            clearInterval(countdown);
            timerDisplay.textContent = 'Your Lounge Time Has Ended';
            timerDisplay.style.color = '#ff4444';
            extendBtn.disabled = true;
            addButtons.forEach(btn => btn.disabled = true);
        }
    }, 1000);

    extendBtn.addEventListener('click', () => {
        paymentSection.classList.remove('hidden');
        extendBtn.style.display = 'none';
    });

    payBtn.addEventListener('click', async () => {
        try {
            const response = await fetch(`/api/visitors/${visitorId}/initiate-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const result = await response.json();
            if (response.ok) {
                paymentMessage.textContent = result.message || 'Payment successful! Time extended.';
                paymentMessage.style.color = '#f5c107';
                timeLeft += 60;
                fetchAndDisplayAds();
            } else {
                paymentMessage.textContent = result.message || 'Payment failed.';
                paymentMessage.style.color = '#ff4444';
            }
        } catch (err) {
            console.error('Payment Fetch Error:', err);
            paymentMessage.textContent = 'Network error. Please try again.';
            paymentMessage.style.color = '#ff4444';
        }
    });

    addButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const service = button.dataset.service;
            const cost = parseInt(button.dataset.cost);
            try {
                const response = await fetch(`/api/visitors/${visitorId}/request-service`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ service, cost })
                });
                const result = await response.json();
                if (response.ok) {
                    popup.textContent = `${service} request sent!`;
                    popup.classList.remove('hidden');
                    setTimeout(() => popup.classList.add('hidden'), 2000);
                    fetchAndDisplayAds();
                } else {
                    popup.textContent = result.message || 'Request failed.';
                    popup.classList.remove('hidden');
                    popup.style.background = '#ff4444';
                    setTimeout(() => {
                        popup.classList.add('hidden');
                        popup.style.background = '#f5c107';
                    }, 2000);
                }
            } catch (err) {
                console.error('Service Request Fetch Error:', err);
                popup.textContent = 'Network error during request.';
                popup.classList.remove('hidden');
                popup.style.background = '#ff4444';
                setTimeout(() => {
                    popup.classList.add('hidden');
                    popup.style.background = '#f5c107';
                }, 2000);
            }
        });
    });

    const fetchAndDisplayAds = async () => {
        try {
            const response = await fetch(`/api/visitors/${visitorId}/score`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            const result = await response.json();
            if (response.ok) {
                const score = result.visitorScore;
                displayAds(score);
            } else {
                console.error('Failed to fetch visitor score:', result.message);
                adsList.innerHTML = '<p style="color: #ff4444">Unable to load offers at this time.</p>';
            }
        } catch (err) {
            console.error('Ads Fetch Error:', err);
            adsList.innerHTML = '<p style="color: #ff4444">Network error loading offers.</p>';
        }
    };

    const displayAds = (score) => {
        let ads = [];
        if (score <= 50) {
            ads = [
                { title: 'Try Our Refreshments', text: 'Get a free drink on your next visit!', img: 'images/refreshments.jpg' },
                { title: 'Wi-Fi Access', text: 'Stay connected for free today.', img: 'images/wifi.png' }
            ];
        } else if (score <= 150) {
            ads = [
                { title: 'Cocktail Special', text: 'Buy one, get one 50% off this week!', img: 'images/cocktails.jfif' },
                { title: 'Private Booth', text: 'Reserve a booth for only $10.', img: 'images/booth.jfif' }
            ];
        } else if (score <= 500) {
            ads = [
                { title: 'Massage Upgrade', text: '20% off your next massage session.', img: 'images/massage.jpg' },
                { title: 'Gaming Zone', text: 'Extended playtime for $8.', img: 'images/gaming.avif' }
            ];
        } else {
            ads = [
                { title: 'VIP Spa Day', text: 'Exclusive spa package at 30% off!', img: 'images/spa.avif' },
                { title: 'Sauna Retreat', text: 'Free sauna session with any purchase.', img: 'images/sauna.jfif' }
            ];
        }

        adsList.innerHTML = ads.map(ad => `
            <div class="ad-card">
                <img src="${ad.img}" alt="${ad.title}">
                <h3>${ad.title}</h3>
                <p>${ad.text}</p>
                <button class="ad-btn">Claim Offer</button>
            </div>
        `).join('');
    };

    fetchAndDisplayAds();
    setInterval(fetchAndDisplayAds, 30000);
});