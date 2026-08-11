/**
 * ==========================================================================
 * Technology & Enterprise Contact Form - Production-Ready Vanilla JS
 * Handles validation, honeypot anti-spam, fetch API submission,
 * loading state ("Sending..."), error messaging, and state reset.
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', function () {
  const contactForm = document.getElementById('contactForm');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  const successCard = document.getElementById('formSuccessCard');
  const errorCard = document.getElementById('formErrorCard');
  const errorCardMessage = document.getElementById('errorCardMessage');
  const resetFormBtn = document.getElementById('resetFormBtn');
  const honeypotInput = document.getElementById('_website_url_hp');

  if (!contactForm) return;

  // Form Field References & Validation Rules
  const fields = {
    fullName: {
      input: document.getElementById('fullName'),
      group: document.getElementById('group-fullName'),
      errorMsg: document.getElementById('error-fullName'),
      validate: (val) => {
        if (!val.trim()) return 'Full name is required.';
        if (val.trim().length < 2) return 'Full name must be at least 2 characters.';
        return '';
      }
    },
    workEmail: {
      input: document.getElementById('workEmail'),
      group: document.getElementById('group-workEmail'),
      errorMsg: document.getElementById('error-workEmail'),
      validate: (val) => {
        if (!val.trim()) return 'Work email address is required.';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(val.trim())) return 'Please enter a valid work email address.';
        return '';
      }
    },
    phoneNumber: {
      input: document.getElementById('phoneNumber'),
      group: document.getElementById('group-phoneNumber'),
      errorMsg: document.getElementById('error-phoneNumber'),
      validate: (val) => {
        if (!val.trim()) return ''; // Phone number is optional
        const phoneRegex = /^[\d\+\-\s\(\)]{7,20}$/;
        if (!phoneRegex.test(val.trim())) return 'Please enter a valid phone number format.';
        return '';
      }
    },
    companyName: {
      input: document.getElementById('companyName'),
      group: document.getElementById('group-companyName'),
      errorMsg: document.getElementById('error-companyName'),
      validate: () => '' // Optional field
    },
    enquiryType: {
      input: document.getElementById('enquiryType'),
      group: document.getElementById('group-enquiryType'),
      errorMsg: document.getElementById('error-enquiryType'),
      validate: (val) => {
        if (!val) return 'Please select an enquiry type.';
        return '';
      }
    },
    subject: {
      input: document.getElementById('subject'),
      group: document.getElementById('group-subject'),
      errorMsg: document.getElementById('error-subject'),
      validate: (val) => {
        if (!val.trim()) return 'Subject line is required.';
        if (val.trim().length < 3) return 'Subject must be at least 3 characters.';
        return '';
      }
    },
    message: {
      input: document.getElementById('message'),
      group: document.getElementById('group-message'),
      errorMsg: document.getElementById('error-message'),
      validate: (val) => {
        if (!val.trim()) return 'Please enter your message details.';
        if (val.trim().length < 10) return 'Message must be at least 10 characters long.';
        return '';
      }
    },
    privacyConsent: {
      input: document.getElementById('privacyConsent'),
      group: document.getElementById('group-privacyConsent'),
      errorMsg: document.getElementById('error-privacyConsent'),
      validate: (val, input) => {
        if (!input.checked) return 'You must agree to the Privacy Policy to submit an enquiry.';
        return '';
      }
    }
  };

  /**
   * Helper function to show or clear field error
   */
  function setFieldError(fieldObj, errorMessage) {
    if (!fieldObj || !fieldObj.group) return;
    if (errorMessage) {
      fieldObj.group.classList.add('has-error');
      if (fieldObj.errorMsg) {
        fieldObj.errorMsg.textContent = errorMessage;
      }
      if (fieldObj.input) {
        fieldObj.input.setAttribute('aria-invalid', 'true');
      }
    } else {
      fieldObj.group.classList.remove('has-error');
      if (fieldObj.errorMsg) {
        fieldObj.errorMsg.textContent = '';
      }
      if (fieldObj.input) {
        fieldObj.input.removeAttribute('aria-invalid');
      }
    }
  }

  /**
   * Real-time & Blur validation listeners
   */
  Object.keys(fields).forEach((key) => {
    const fieldObj = fields[key];
    if (!fieldObj.input) return;

    // Validate on blur
    fieldObj.input.addEventListener('blur', function () {
      const val = fieldObj.input.value;
      const error = fieldObj.validate(val, fieldObj.input);
      setFieldError(fieldObj, error);
    });

    // Clear error on input / change
    const eventType = fieldObj.input.type === 'checkbox' || fieldObj.input.tagName === 'SELECT' ? 'change' : 'input';
    fieldObj.input.addEventListener(eventType, function () {
      if (fieldObj.group.classList.contains('has-error')) {
        const val = fieldObj.input.value;
        const error = fieldObj.validate(val, fieldObj.input);
        setFieldError(fieldObj, error);
      }
    });
  });

  /**
   * Main Form Submit Handler
   */
  contactForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    hideErrorCard();

    let isValid = true;
    let firstInvalidInput = null;

    // Validate all fields
    Object.keys(fields).forEach((key) => {
      const fieldObj = fields[key];
      if (!fieldObj.input) return;

      const val = fieldObj.input.value;
      const error = fieldObj.validate(val, fieldObj.input);

      if (error) {
        setFieldError(fieldObj, error);
        isValid = false;
        if (!firstInvalidInput) {
          firstInvalidInput = fieldObj.input;
        }
      } else {
        setFieldError(fieldObj, '');
      }
    });

    // If validation fails, focus first invalid field
    if (!isValid) {
      if (firstInvalidInput) {
        firstInvalidInput.focus();
      }
      return;
    }

    // Collect form payload including honeypot field
    const formData = {
      fullName: fields.fullName.input.value.trim(),
      workEmail: fields.workEmail.input.value.trim(),
      phoneNumber: fields.phoneNumber.input.value.trim(),
      companyName: fields.companyName.input.value.trim(),
      enquiryType: fields.enquiryType.input.value,
      subject: fields.subject.input.value.trim(),
      message: fields.message.input.value.trim(),
      privacyConsent: fields.privacyConsent.input.checked,
      _website_url_hp: honeypotInput ? honeypotInput.value : '',
      submittedAt: new Date().toISOString()
    };

    // Set Loading UI State ("Sending...")
    setLoadingState(true);

    try {
      /**
       * Send request to secure backend API endpoint (/api/contact)
       * Note: If hosting on a separate domain/serverless provider (e.g. Vercel, AWS Lambda),
       * replace '/api/contact' below with your deployed API URL (e.g. 'https://api.yourdomain.com/contact').
       */
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setLoadingState(false);
        handleSuccessfulSubmission();
      } else {
        setLoadingState(false);
        const errorText = result.error || "Sorry, something went wrong. Please try again or contact me directly by email.";
        showErrorCard(errorText);
      }
    } catch (err) {
      console.error('Contact Form submission error:', err);
      setLoadingState(false);
      showErrorCard("Sorry, something went wrong. Please try again or contact me directly by email.");
    }
  });

  /**
   * Controls button loading state during API submission
   */
  function setLoadingState(isLoading) {
    if (isLoading) {
      submitBtn.classList.add('is-loading');
      submitBtn.disabled = true;
      btnText.textContent = 'Sending...';
    } else {
      submitBtn.classList.remove('is-loading');
      submitBtn.disabled = false;
      btnText.textContent = 'Send Enquiry';
    }
  }

  /**
   * Shows error notification card
   */
  function showErrorCard(message) {
    if (errorCard) {
      if (errorCardMessage) {
        errorCardMessage.textContent = message;
      }
      errorCard.classList.add('is-visible');
      errorCard.setAttribute('aria-hidden', 'false');
      errorCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  /**
   * Hides error notification card
   */
  function hideErrorCard() {
    if (errorCard) {
      errorCard.classList.remove('is-visible');
      errorCard.setAttribute('aria-hidden', 'true');
    }
  }

  /**
   * Handles successful submission transition
   */
  function handleSuccessfulSubmission() {
    // Hide form fields
    contactForm.style.display = 'none';

    // Show polished success banner
    if (successCard) {
      successCard.classList.add('is-visible');
      successCard.setAttribute('aria-hidden', 'false');
      successCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Reset actual form fields
    contactForm.reset();

    // Clear field validation indicators
    Object.keys(fields).forEach((key) => {
      setFieldError(fields[key], '');
    });
  }

  /**
   * Reset form view to send another enquiry
   */
  if (resetFormBtn) {
    resetFormBtn.addEventListener('click', function () {
      if (successCard) {
        successCard.classList.remove('is-visible');
        successCard.setAttribute('aria-hidden', 'true');
      }
      hideErrorCard();
      contactForm.style.display = 'flex';
      fields.fullName.input.focus();
    });
  }
});
