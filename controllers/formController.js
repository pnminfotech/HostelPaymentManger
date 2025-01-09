const Form = require('../models/formModels');
const DuplicateForm = require('../models/DuplicateForm'); // Import the DuplicateForm model
function getMonthYear() {
  const date = new Date();
  const month = date.getMonth() + 1; // getMonth() returns 0-11, so we add 1 to get the month number
  const year = date.getFullYear();
  return `${month}-${year}`;
}

// @desc Save form data to the database
// @route POST /api/forms
// @access Public
const saveForm = async (req, res) => {
  try {
    // Log incoming request body to debug
    console.log('Request Body:', req.body);

    const { rents, ...otherFields } = req.body;

    // Validate and process rents
    const validatedRents = rents.map((rent) => ({
      rentAmount: Number(rent.rentAmount), // Ensure rentAmount is a number
      date: new Date(rent.date), // Ensure date is a valid Date object
    }));

    // Create and save form
    const form = new Form({
      ...otherFields,
      rents: validatedRents,
    });

    const savedForm = await form.save();
    res.status(201).json(savedForm);
  } catch (error) {
    console.error('Error saving form:', error);
    res.status(400).json({ message: error.message });
  }
};

// @desc Get all forms from the database
// @route GET /api/forms
// @access Public
const getAllForms = async (req, res) => {
  try {
    const forms = await Form.find();
    res.status(200).json(forms);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Update rent for a specific form
// @route PUT /api/forms/:id
// @access Public
// @desc Update rent for a specific form
// @route PUT /api/forms/:id
// @access Public
const updateForm = async (req, res) => {
  const { id } = req.params;
  const { rentAmount, date } = req.body;

  try {
    // Get the month-year representation of the input date
    const monthYear = getMonthYear(date); // Function to return formatted "Mon-YY"

    // Find the form by ID
    const form = await Form.findById(id);

    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }

    // Check if a rent entry for the given month already exists
    const existingRentIndex = form.rents.findIndex((rent) => getMonthYear(rent.date) === monthYear);

    if (existingRentIndex !== -1) {
      // If rent for the same month exists, update it
      form.rents[existingRentIndex] = { rentAmount: Number(rentAmount), date: new Date(date) };
    } else {
      // If no rent for the given month, add a new entry
      form.rents.push({ rentAmount: Number(rentAmount), date: new Date(date) });
    }

    // Save the form after modification
    const updatedForm = await form.save();
    res.status(200).json(updatedForm);
  } catch (error) {
    console.error('Error updating rent:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc Delete a form and move its data to the DuplicateForm model
// @route DELETE /api/forms/:id
// @access Public
const deleteForm = async (req, res) => {
  const { id } = req.params;

  try {
    // Find the form to delete
    const formToDelete = await Form.findById(id);

    if (!formToDelete) {
      return res.status(404).json({ message: 'Form not found' });
    }

    // Create a new duplicate form using the data from the original form
    const duplicateForm = new DuplicateForm({
      originalFormId: formToDelete._id,
      formData: formToDelete, // Save all the form's data
      deletedAt: Date.now(),
    });

    // Save the duplicate form
    await duplicateForm.save();

    // Delete the original form
    await Form.findByIdAndDelete(id);

    res.status(200).json({ message: 'Form deleted and saved as a duplicate successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const getDuplicateForms = async (req, res) => {
  try {
    const duplicateForms = await DuplicateForm.find().populate('originalFormId').exec();
    res.status(200).json(duplicateForms);
  } catch (err) {
    console.error('Error fetching duplicate forms:', err.message);
    res.status(500).json({ message: 'Error fetching duplicate forms' });
  }
};

module.exports = { saveForm, getAllForms, updateForm, deleteForm ,getDuplicateForms };
