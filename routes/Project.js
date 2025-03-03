const express = require("express");
const router = express.Router();
// const { suppliersDB } = require("../config/mainte");
// const ProjectSchema = require("../models/Project"); // Import the model directly
// const SupplierSchema = require("../models/Supplier");
const mongoose = require("mongoose");
// Models
const Project = require("../models/Project");
const Supplier = require("../models/Supplier");

// Create Project
router.post("/emp/projects", async (req, res) => {
    try {
        const { heading,date, description } = req.body;
        const project = new Project({ heading, date, description, employees: [] });
        await project.save();
        res.status(201).json(project);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all projects
router.get("/projects", async (req, res) => {
    try {
        const projects = await Project.find();
        res.json(projects);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

//to fexth Projects
router.get("/projects/:projectId", async (req, res) => {
    try {
      const project = await Project.findById(req.params.projectId).populate("suppliers");
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  });

  //adding Employee to the project.
router.post("/projects/:id/employees", async (req, res) => {
    try {
        const { name, phoneNo, roleOrMaterial, salaryOrTotalPayment} = req.body;
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ message: "Project not found" });

        const newEmployee = { name, phoneNo, roleOrMaterial, salaryOrTotalPayment, payments: [] };
        project.employees.push(newEmployee);
        await project.save();

        res.status(201).json(project);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Used for adding Payemnts
router.post("/projects/:projectId/employees/:employeeId/payments", async (req, res) => {
    try {
        const { amount, date,  description } = req.body;
        const project = await Project.findById(req.params.projectId);
        if (!project) return res.status(404).json({ message: "Project not found" });

        const employee = project.employees.id(req.params.employeeId);
        if (!employee) return res.status(404).json({ message: "Employee not found" });

        employee.payments.push({ amount, date,  description });
        await project.save();

        res.status(201).json(project);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

//to add supplier to the project 
router.post("/projects/:projectId/suppliers", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { supplierId, materials, payment } = req.body;

    console.log("Supplier ID received:", supplierId);

    // Validate projectId and supplierId
    if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(supplierId)) {
      return res.status(400).json({ message: "Invalid Project ID or Supplier ID format" });
    }

    // Fetch supplier
    const supplier = await Supplier.findById(supplierId);
    if (!supplier) {
      console.log("Supplier not found in DB:", supplierId);
      return res.status(404).json({ message: "Supplier not found in database" });
    }

    // Fetch project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check if supplier already exists in the project
    let existingSupplier = project.suppliers.find(s => s.supplierId.toString() === supplierId);

    if (existingSupplier) {
      // Update existing supplier's materials and payments in project
      existingSupplier.materials = [...existingSupplier.materials, ...(materials || [])];
      existingSupplier.payment = (existingSupplier.payment || 0) + (payment || 0);
    } else {
      // Add supplier to project
      project.suppliers.push({
        supplierId: supplier._id,
        name: supplier.name,
        phoneNo: supplier.phoneNo,
        materials: materials || [],
        payment: payment || 0,
      });
    }

    // Add project reference to supplier
    let existingProject = supplier.projects.find(p => p.projectId.toString() === projectId);
    if (existingProject) {
      existingProject.materials = [...existingProject.materials, ...(materials || [])];
      existingProject.payment = (existingProject.payment || 0) + (payment || 0);
    } else {
      supplier.projects.push({
        projectId: project._id,
        projectName: project.name,
        materials: materials || [],
        payment: payment || 0,
      });
    }

    // Save changes
    await project.save();
    await supplier.save();

    res.status(201).json({ message: "Supplier updated in project and supplier record", project, supplier });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Error adding supplier", error });
  }
});


//fetch all the supplier which are added into the project.
router.get("/projects/:projectId/suppliers", async (req, res) => {
  try {
    const suppliers = await Supplier.find().select("name phoneNo _id");
    res.status(200).json(suppliers);
  } catch (error) {
    res.status(500).json({ message: "Error fetching suppliers", error });
  }
});



// Add a payment to a material in a supplier inside a project
// router.post("/projects/:projectId/suppliers/:supplierId/materials/:materialId/payments", async (req, res) => {
//   try {
//     const { projectId, supplierId, materialId } = req.params;
//     const { amount, description } = req.body;

//     if (!amount || !description) {
//       return res.status(400).json({ message: "Amount and description are required" });
//     }

//     // Find the project
//     const project = await Project.findById(projectId);
//     if (!project) {
//       return res.status(404).json({ message: "Project not found" });
//     }

//     // Find the supplier inside the project
//     const supplier = project.suppliers.find(s => s.supplierId.toString() === supplierId);
//     if (!supplier) {
//       return res.status(404).json({ message: "Supplier not found in project" });
//     }

//     // Find the material inside the supplier
//     const material = supplier.materials.find(m => m._id.toString() === materialId);
//     if (!material) {
//       return res.status(404).json({ message: "Material not found in supplier" });
//     }

//     // Add the payment to the material's payments array
//     const newPayment = {
//       amount: parseFloat(amount),
//       description,
//       date: new Date(),
//     };
//     material.payments.push(newPayment);

//     // Save the updated project
//     await project.save();

//     res.status(200).json({ message: "Payment added successfully", project });
//   } catch (error) {
//     console.error("Error adding payment:", error);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// });


//for putting the supplier into project.
// router.post("/projects/:projectId/suppliers/:supplierId", async (req, res) => {
//   try {
//       const projectId = req.params.projectId;
//       if (!mongoose.Types.ObjectId.isValid(projectId)) {
//           return res.status(400).json({ error: "Invalid project ID" });
//       }
//       // Proceed with the database operation
//   } catch (error) {
//       res.status(500).json({ error: error.message });
//   }
// });



module.exports = router;
//router.post("/", async (req, res) => {
//     try {
//       const { supplierId, supplierName, material, paymentAmount } = req.body;
  
//       const newProject = new Project({
//         supplierId,
//         supplierName,
//         material,
//         paymentAmount
//       });
  
//       await newProject.save();
//       res.status(201).json(newProject);
//     } catch (err) {
//       res.status(500).json({ message: err.message });
//     }
//   });
