const express = require('express');
const router = express.Router();
const CustomDesign = require('../models/CustomDesign');
const { protect } = require('../middleware/authMiddleware');

// @desc    Create a new custom design brief entry / Get all entries
// @route   POST /api/custom-designs & GET /api/custom-designs
// @access  Private (Requires valid login authorization token)
router.route('/')
  .post(protect, async (req, res, next) => {
    try {
      const { customerName, userEmail, files, notes } = req.body;

      // Direct sanity verification checks
      if (!notes || notes.trim() === '') {
        return res.status(400).json({ success: false, message: 'Please provide structural description notes for your custom piece.' });
      }

      if (!customerName || !userEmail) {
        return res.status(400).json({ success: false, message: 'Customer profile details (name and email) are required.' });
      }

      // Build the document directly into your collection matching your exact custom schema fields
      const designBrief = await CustomDesign.create({
        customerName,
        userEmail,
        files: Array.isArray(files) ? files : [],
        notes
      });

      return res.status(201).json({ success: true, data: designBrief });
    } catch (error) {
      // Passes the error layout safely down to your server's global error handler middleware
      next(error);
    }
  })
  .get(protect, async (req, res, next) => {
    try {
      // Fetch all user designs sorted from newest to oldest for the admin panel layout
      const designs = await CustomDesign.find({}).sort({ createdAt: -1 });
      return res.status(200).json({ success: true, count: designs.length, data: designs });
    } catch (error) {
      next(error);
    }
  });

// @desc    Modify workflow status tracker or delete design brief documents by ID
// @route   PUT /api/custom-designs/:id & DELETE /api/custom-designs/:id
// @access  Private (Requires valid login authorization token)
router.route('/:id')
  .put(protect, async (req, res, next) => {
    try {
      const design = await CustomDesign.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { new: true, runValidators: true }
      );
      
      if (!design) {
        return res.status(404).json({ success: false, message: 'Target custom brief document could not be found.' });
      }
      
      return res.status(200).json({ success: true, data: design });
    } catch (error) {
      next(error);
    }
  })
  .delete(protect, async (req, res, next) => {
    try {
      const design = await CustomDesign.findByIdAndDelete(req.params.id);
      
      if (!design) {
        return res.status(404).json({ success: false, message: 'Target custom brief document could not be found.' });
      }
      
      return res.status(200).json({ success: true, message: 'Design item dropped cleanly from database cluster.' });
    } catch (error) {
      next(error);
    }
  });

module.exports = router;