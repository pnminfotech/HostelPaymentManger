const Form = require('../models/formModels');
const Archive = require('../models/archiveSchema');
const DuplicateForm = require('../models/DuplicateForm'); // Import the DuplicateForm model
const cron = require("node-cron");


const processLeave = async (req, res) => {
  try {
    const { formId, leaveDate } = req.body;
    const form = await Form.findById(formId);

    if (!form) return res.status(404).json({ error: "Form not found" });

    const currentDate = new Date().toISOString().split("T")[0];

    if (leaveDate <= currentDate) {
      // If the leave date is past or current, move the record to archive
      const archivedData = new Archive({ ...form.toObject(), leaveDate });
      await archivedData.save();
      await Form.findByIdAndDelete(formId);

      return res.status(200).json({ message: "Record archived successfully." });
    } else {
      // If leave date is in the future, update the form record
      form.leaveDate = leaveDate;
      await form.save();
      return res.status(200).json({ message: "Leave date saved. It will be archived on the leave date." });
    }
  } catch (error) {
    console.error("Error processing leave:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// CRON JOB to check for leave dates every day at midnight
cron.schedule("0 0 * * *", async () => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const formsToArchive = await Form.find({ leaveDate: today });

    for (const form of formsToArchive) {
      const archivedData = new Archive({ ...form.toObject(), leaveDate: today });
      await archivedData.save();
      await Form.findByIdAndDelete(form._id);
    }

    console.log(`Archived ${formsToArchive.length} records for ${today}`);
  } catch (error) {
    console.error("Error archiving records:", error);
  }
});

// @desc Save form data to the database
// @route POST /api/forms
// @access Public
const saveForm = async (req, res) => {
  try {
    // Log incoming request body to debug
    console.log('Request Body:', req.body);

    // const { rents, ...otherFields } = req.body;

    // // Validate and process rents
    // const validatedRents = rents.map((rent) => ({
    //   rentAmount: Number(rent.rentAmount), // Ensure rentAmount is a number
    //   date: new Date(rent.date), // Ensure date is a valid Date object
    // }));

    // Create and save form
    // const form = new Form({
    //   ...otherFields,
    //   rents: validatedRents,
    // });
    const form = new Form(req.body);
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

const getMonthYear = (date) => {
  const d = new Date(date);
  return `${d.toLocaleString('default', { month: 'short' })}-${d.getFullYear().toString().slice(-2)}`;
};


const updateForm = async (req, res) => {
  const { id } = req.params;
  const { rentAmount, date } = req.body;

  try {
    const form = await Form.findById(id);
    if (!form) return res.status(404).json({ message: "Form not found" });

    const monthYear = getMonthYear(date);
    const rentIndex = form.rents.findIndex((rent) => getMonthYear(rent.date) === monthYear);

    if (rentIndex !== -1) {
      form.rents[rentIndex] = { rentAmount: Number(rentAmount), date: new Date(date) };
    } else {
      form.rents.push({ rentAmount: Number(rentAmount), date: new Date(date) });
    }

    const updatedForm = await form.save();
    res.status(200).json(updatedForm); // Return updated form data
  } catch (error) {
    res.status(500).json({ message: "Error updating rent: " + error.message });
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

const saveLeaveDate = async (req, res) => {
  const { id, leaveDate } = req.body;

  try {
    const form = await Form.findById(id);
    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }

    form.leaveDate = new Date(leaveDate);
    await form.save();

    res.status(200).json({ form, leaveDate: form.leaveDate });
  } catch (error) {
    res.status(500).json({ message: "Error saving leave date: " + error.message });
  }
};

// Function to check and archive expired leave dates
const checkAndArchiveLeaves = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Ensure comparison is date-only

    // Find forms where leaveDate is exactly today
    const expiredForms = await Form.find({ leaveDate: today });

    for (let form of expiredForms) {
      await archiveAndDeleteForm(form);
    }

    console.log("Checked and archived expired leave records.");
  } catch (error) {
    console.error("Error checking and archiving leaves:", error);
  }
};

// Schedule this to run every midnight
setInterval(checkAndArchiveLeaves, 24 * 60 * 60 * 1000); 

// Function to archive and delete form
const archiveAndDeleteForm = async (form) => {
  const archivedData = new Archive({ ...form._doc });
  await archivedData.save();
  await Form.findByIdAndDelete(form._id);
};

// Schedule the archive check to run daily at midnight


// Fetch all forms with leave dates to display them on the frontend
const getForms = async (req, res) => {
  try {
    const forms = await Form.find({});
    res.status(200).json(forms);
  } catch (error) {
    res.status(500).json({ message: "Error fetching forms: " + error.message });
  }
};

const archiveForm = async (req, res) => {
  const { id } = req.body;

  try {
    const formToArchive = await Form.findById(id);
    if (!formToArchive) {
      return res.status(404).json({ message: 'Form not found' });
    }

    const archivedData = new Archive({
      ...formToArchive._doc, // Copy all data
    });

    await archivedData.save();
    await Form.findByIdAndDelete(id);

    res.status(200).json(archivedData);
  } catch (error) {
    res.status(500).json({ message: 'Error archiving form: ' + error.message });
  }
};


const restoreForm = async (req, res) => {
  const { id } = req.body;
  console.log('Restore Request ID:', id);

  try {
    const archivedData = await Archive.findById(id);
    console.log('Archived Data Found:', archivedData);

    if (!archivedData) {
      return res.status(404).json({ message: 'Archived data not found' });
    }

    // Create a new form document using archived data
    const restoredForm = new Form({
      srNo: archivedData.srNo,
      name: archivedData.name,
      joiningDate: archivedData.joiningDate,
      roomNo: archivedData.roomNo,
      depositAmount: archivedData.depositAmount,
      address: archivedData.address,
      phoneNo: archivedData.phoneNo,
      relativeAddress1: archivedData.relativeAddress1,
      relativeAddress2: archivedData.relativeAddress2,
      floorNo: archivedData.floorNo,
      bedNo: archivedData.bedNo,
      companyAddress: archivedData.companyAddress,
      dateOfJoiningCollege: archivedData.dateOfJoiningCollege,
      dob: archivedData.dob,
      rents: archivedData.rents,
      leaveDate: archivedData.leaveDate,
    });

    // Save the restored form data
    await restoredForm.save();
    console.log('Restored Data:', restoredForm);

    // Remove the record from the archive
    await Archive.findByIdAndDelete(id);
    console.log('Archived Data Deleted:', id);

    res.status(200).json(restoredForm);
  } catch (error) {
    console.error('Error restoring archived data:', error.message);
    res.status(500).json({ message: 'Error restoring archived data' });
  }
};


const getArchivedForms = async (req, res) => {
  try {
    const archivedForms = await Archive.find(); // Fetch all archived forms
    res.status(200).json(archivedForms);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching archived forms: ' + error.message });
  }
};

// Update form details
const updateProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Find the entity by ID and update it with new data
    const updatedForm = await Form.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedForm) {
      return res.status(404).json({ message: "Entity not found" });
    }

    res.status(200).json(updatedForm);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};


const getFormById = async (req, res) => {
  try {
    const { id } = req.params;
    const form = await Archive.findById(id);

    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }

    res.json(form);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

//for rentAmount updation Logic 0 

const rentAmountDel = async (req, res) => {
  const { formId, monthYear } = req.params;

  try {
    const form = await Form.findById(formId);
    if (!form) return res.status(404).json({ message: "Form not found" });

    // Remove rent entry for the specified month
    form.rents = form.rents.filter((rent) => getMonthYear(rent.date) !== monthYear);
    await form.save();

    res.status(200).json({ message: "Rent entry removed successfully", form });
  } catch (error) {
    console.error("Error removing rent entry:", error);
    res.status(500).json({ message: "Failed to remove rent", error });
  }
};
module.exports = {rentAmountDel , processLeave , getFormById , getForms, checkAndArchiveLeaves, updateProfile , getArchivedForms,saveLeaveDate, restoreForm  , archiveForm , saveForm, getAllForms, updateForm, deleteForm ,getDuplicateForms };
