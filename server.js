const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB connection
const dbURI = 'mongodb+srv://selva:Selva@cluster0.pevzx7l.mongodb.net/mentor-student?retryWrites=true&w=majority';
mongoose.connect(dbURI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Mentor model
const Mentor = mongoose.model('Mentors', {
  name: String,
});

// Student model
const Student = mongoose.model('Students', {
  name: String,
  email: { type: String, unique: true, sparse: true },
  mentor: { type: mongoose.Schema.Types.ObjectId, ref: 'Mentor' }
});

// API Routes
app.post('/api/mentors', async (req, res) => {
  try {
    const mentor = new Mentor(req.body);
    const savedMentor = await mentor.save();
    res.status(201).send(savedMentor);
  } catch (error) {
    console.error('Error creating mentor:', error);
    res.status(500).send(error);
  }
});

app.post('/api/students', async (req, res) => {
  try {
    const student = new Student(req.body);
    const savedStudent = await student.save();
    res.status(201).send(savedStudent);
  } catch (error) {
    if (error.code === 11000 && error.keyPattern.email === 1) {
      console.error('Duplicate email error:', error);
      res.status(400).send('Email must be unique');
    } else {
      console.error('Error creating student:', error);
      res.status(500).send(error);
    }
  }
});

app.post('/api/mentors/:mentorId/students', async (req, res) => {
  try {
    const { mentorId } = req.params;
    const { studentIds } = req.body;

    console.log(`Received mentorId: ${mentorId}`);
    console.log(`Received studentIds: ${studentIds}`);

    if (!mongoose.Types.ObjectId.isValid(mentorId)) {
      return res.status(400).send({ error: 'Invalid mentor ID' });
    }

    const invalidIds = studentIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).send({ error: `Invalid student IDs: ${invalidIds.join(', ')}` });
    }

    const mentor = await Mentor.findById(mentorId);
    if (!mentor) {
      return res.status(404).send({ error: 'Mentor not found' });
    }

    const result = await Student.updateMany(
      { _id: { $in: studentIds } },
      { $set: { mentor: mentorId } }
    );

    console.log(`Update result: ${JSON.stringify(result)}`);

    if (result.modifiedCount === 0) {
      return res.status(404).send({ message: 'No students found to update' });
    }

    res.status(200).send({ message: 'Students assigned to mentor successfully' });
  } catch (error) {
    console.error('Error assigning students to mentor:', error.message);
    res.status(500).send({ error: 'Internal Server Error' });
  }
});

// Fetch all students
app.get('/api/students', async (req, res) => {
  try {
    const students = await Student.find({}, '_id name');
    res.status(200).send(students);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).send(error);
  }
});

// Fetch all mentors
app.get('/api/mentors', async (req, res) => {
  try {
    const mentors = await Mentor.find({}, '_id name');
    res.status(200).send(mentors);
  } catch (error) {
    console.error('Error fetching mentors:', error);
    res.status(500).send(error);
  }
});

// Change mentor for a student
app.put('/api/students/:studentId/mentor', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { mentorId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).send({ error: 'Invalid student ID' });
    }

    if (!mongoose.Types.ObjectId.isValid(mentorId)) {
      return res.status(400).send({ error: 'Invalid mentor ID' });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).send({ error: 'Student not found' });
    }

    student.mentor = mentorId;
    await student.save();

    res.status(200).send({ message: 'Mentor updated successfully' });
  } catch (error) {
    console.error('Error changing mentor:', error);
    res.status(500).send({ error: 'Internal Server Error' });
  }
});

// Get the previously assigned mentor for a student
app.get('/api/students/:studentId/mentor', async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).send({ error: 'Invalid student ID' });
    }

    const student = await Student.findById(studentId).populate('mentor');
    if (!student) {
      return res.status(404).send({ error: 'Student not found' });
    }

    if (!student.mentor) {
      return res.status(404).send({ error: 'No mentor assigned' });
    }

    res.status(200).send(student.mentor);
  } catch (error) {
    console.error('Error fetching previous mentor for student:', error.message);
    res.status(500).send({ error: 'Internal Server Error' });
  }
});

// Fetch all students for a particular mentor
app.get('/api/mentors/:mentorId/students', async (req, res) => {
  try {
    const { mentorId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(mentorId)) {
      return res.status(400).send({ error: 'Invalid mentor ID' });
    }

    const students = await Student.find({ mentor: mentorId });
    res.status(200).send(students);
  } catch (error) {
    console.error('Error fetching students for mentor:', error);
    res.status(500).send(error);
  }
});

// Serve static files from the React frontend app
app.use(express.static(path.join(__dirname, 'build')));

// Anything that doesn't match the above routes should be handled by React router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
