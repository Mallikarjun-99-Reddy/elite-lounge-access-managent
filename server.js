require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const nodemailer = require('nodemailer');

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(express.static('public'));

const uri = process.env.MONGODB_URI;
let db;

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

(async () => {
    try {
        const client = await MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
        db = client.db('leadsDB');
        console.log('Connected to MongoDB');
    } catch (err) {
        console.error('MongoDB Connection Failed:', err);
        process.exit(1);
    }
})();

const calculateVisitorScore = (visitor) => {
    let score = 0;
    score += visitor.visitCount * 15;
    score += Math.floor(visitor.totalSpent / 5);
    const accessMethodPoints = { 'Membership': 75, 'Referral': 60, 'Online Booking': 50 };
    score += accessMethodPoints[visitor.accessMethod] || 0;
    score += visitor.timeExtensions * 25;
    score += visitor.paymentInitiations * 10;
    score += (visitor.serviceRequests?.length || 0) * 20;
    return Math.min(Math.round(score), 1500);
};

const sendWelcomeEmail = async (to, name) => {
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to,
            subject: `Welcome to Elite Lounge, ${name}!`,
            text: `Dear ${name},\n\nWelcome to Elite Lounge! Enjoy your exclusive retreat.\n\nBest,\nElite Lounge Team`
        });
        console.log(`Welcome Email Sent to ${to}`);
    } catch (err) {
        console.error(`Welcome Email Error: ${err}`);
    }
};

const sendPromoEmail = async (to, subject, visitor) => {
    let discount = '';
    if (visitor.visitorScore > 500) discount = '30% off your next visit with code ELITE30';
    else if (visitor.visitorScore > 150) discount = '20% off your next visit with code ELITE20';
    else discount = '10% off your next visit with code ELITE10';

    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to,
            subject,
            text: `Dear ${visitor.name},\n\nThank you for visiting Elite Lounge! We’d love to see you again. Use this exclusive offer: ${discount}.\n\nBest,\nElite Lounge Team`
        });
        console.log(`Promo Email Sent to ${to} with ${discount}`);
    } catch (err) {
        console.error(`Promo Email Error: ${err}`);
    }
};

// API Endpoints
app.post('/api/checkin', async (req, res) => {
    try {
        const { name, email, phone, accessMethod, visitDate } = req.body;
        if (!name || !email || !phone || !accessMethod || !visitDate) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        const existingVisitor = await db.collection('visitors').findOne({ email });
        const currentTime = new Date();
        const checkInTime = new Date(visitDate);

        let visitor;
        if (existingVisitor) {
            visitor = {
                ...existingVisitor,
                visitCount: existingVisitor.visitCount + 1,
                accessMethod,
                checkInTime,
                loungeTime: 2,
                status: 'active',
                lastVisit: currentTime,
                timeExtensions: existingVisitor.timeExtensions || 0,
                paymentInitiations: existingVisitor.paymentInitiations || 0,
                serviceRequests: existingVisitor.serviceRequests || []
            };
            visitor.visitorScore = calculateVisitorScore(visitor);
            await db.collection('visitors').updateOne({ _id: existingVisitor._id }, { $set: visitor });
        } else {
            visitor = {
                name,
                email,
                phone,
                accessMethod,
                visitCount: 1,
                totalSpent: 0,
                loungeTime: 2,
                checkInTime,
                lastVisit: currentTime,
                status: 'active',
                timeExtensions: 0,
                paymentInitiations: 0,
                serviceRequests: [],
                visitorScore: 0
            };
            visitor.visitorScore = calculateVisitorScore(visitor);
            const result = await db.collection('visitors').insertOne(visitor);
            visitor._id = result.insertedId;
        }

        await sendWelcomeEmail(email, name);

        setTimeout(async () => {
            const updatedVisitor = await db.collection('visitors').findOne({ email });
            if (updatedVisitor && updatedVisitor.status === 'active') {
                await db.collection('visitors').updateOne({ email }, { $set: { status: 'expired', loungeTime: 0 } });
                await sendPromoEmail(email, 'Thank You for Visiting Elite Lounge!', updatedVisitor);
            }
        }, 120 * 1000);

        res.json({ success: true, message: 'Welcome to Elite Lounge!', visitorId: visitor._id.toString() });
    } catch (err) {
        console.error('Check-In Error:', err);
        res.status(500).json({ success: false, message: 'Server error during check-in' });
    }
});

app.post('/api/visitors/:id/initiate-payment', async (req, res) => {
    try {
        const { id } = req.params;
        const visitor = await db.collection('visitors').findOne({ _id: new ObjectId(id) });
        if (!visitor || visitor.status !== 'active') {
            return res.status(400).json({ success: false, message: 'Invalid or expired visitor' });
        }

        const updatedVisitor = {
            ...visitor,
            paymentInitiations: (visitor.paymentInitiations || 0) + 1,
            timeExtensions: (visitor.timeExtensions || 0) + 1,
            totalSpent: visitor.totalSpent + 10,
            loungeTime: visitor.loungeTime + 1
        };
        updatedVisitor.visitorScore = calculateVisitorScore(updatedVisitor);

        await db.collection('visitors').updateOne({ _id: new ObjectId(id) }, { $set: updatedVisitor });
        res.json({ success: true, message: 'Payment initiated successfully! Time extended by 1 minute.' });
    } catch (err) {
        console.error('Payment Error:', err);
        res.status(500).json({ success: false, message: 'Server error during payment' });
    }
});

app.post('/api/visitors/:id/request-service', async (req, res) => {
    try {
        const { id } = req.params;
        const { service, cost } = req.body;
        if (!service || cost === undefined) {
            return res.status(400).json({ success: false, message: 'Service and cost are required' });
        }

        const visitor = await db.collection('visitors').findOne({ _id: new ObjectId(id) });
        if (!visitor || visitor.status !== 'active') {
            return res.status(400).json({ success: false, message: 'Invalid or expired visitor' });
        }

        const updatedVisitor = {
            ...visitor,
            serviceRequests: [...(visitor.serviceRequests || []), { service, cost, timestamp: new Date() }],
            totalSpent: visitor.totalSpent + cost
        };
        updatedVisitor.visitorScore = calculateVisitorScore(updatedVisitor);

        await db.collection('visitors').updateOne({ _id: new ObjectId(id) }, { $set: updatedVisitor });
        res.json({ success: true, message: `${service} requested successfully!` });
    } catch (err) {
        console.error('Service Request Error:', err);
        res.status(500).json({ success: false, message: 'Server error during service request' });
    }
});

app.get('/api/visitors/:id/score', async (req, res) => {
    try {
        const { id } = req.params;
        const visitor = await db.collection('visitors').findOne({ _id: new ObjectId(id) });
        if (!visitor) {
            return res.status(404).json({ success: false, message: 'Visitor not found' });
        }
        res.json({ success: true, visitorScore: visitor.visitorScore });
    } catch (err) {
        console.error('Score Fetch Error:', err);
        res.status(500).json({ success: false, message: 'Server error fetching score' });
    }
});

app.get('/api/visitors', async (req, res) => {
    try {
        const visitors = await db.collection('visitors').find().toArray();
        res.json({ success: true, visitors });
    } catch (err) {
        console.error('Fetch Visitors Error:', err);
        res.status(500).json({ success: false, message: 'Server error fetching visitors' });
    }
});

app.listen(port, () => {
    console.log(`Elite Lounge Running on Port ${port}`);
});