import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Clipboard, Send, Camera, CheckCircle, AlertCircle, RefreshCw, User, Mail, Phone, Building } from 'lucide-react';

export default function BadgeScannerApp() {
  const [scanning, setScanning] = useState(false);
  const [scannedData, setScannedData] = useState(null);
  const [notes, setNotes] = useState('');
  const [interestLevel, setInterestLevel] = useState('Medium');
  const [status, setStatus] = useState({ type: 'info', message: 'Ready to scan' });
  const [lastSubmission, setLastSubmission] = useState(null);
  const [loading, setLoading] = useState(false);
  const [manualEntry, setManualEntry] = useState({
    name: '',
    email: '',
    phone: '',
    company: ''
  });
  const [hasCamera, setHasCamera] = useState(false);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  // Quick note suggestions
  const noteSuggestions = [
    'Demande fiche technique',
    'Liste des prix',
    'Besoin de devis',
    'Rendez-vous de suivi',
    'Appel de rappel',
    'Documentation technique',
    'Démonstration produit',
    'Test',
    'Réunion commerciale',
    'Projet en cours'
  ];

  const addNoteSuggestion = (suggestion) => {
    setNotes(prevNotes => {
      if (prevNotes) {
        return `${prevNotes}\n${suggestion}`;
      }
      return suggestion;
    });
  };

  // Check for camera availability
  useEffect(() => {
    const checkCamera = async () => {
      try {
        // Check if we're in a secure context
        if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
          setStatus({ 
            type: 'error', 
            message: 'Camera access requires HTTPS. Please use a secure connection.' 
          });
          return;
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setHasCamera(videoDevices.length > 0);
        
        if (videoDevices.length === 0) {
          setStatus({ 
            type: 'error', 
            message: 'No camera found. Please connect a camera and refresh the page.' 
          });
        } else {
          setStatus({ 
            type: 'info', 
            message: 'Camera detected. Click "Start Scanner" to begin.' 
          });
        }
      } catch (error) {
        console.error('Error checking camera:', error);
        setStatus({ 
          type: 'error', 
          message: 'Error checking camera availability: ' + error.message 
        });
      }
    };
    checkCamera();
  }, []);

  // Parse QR code data into structured format
  const parseQRData = (data) => {
    console.log('Raw QR data:', data);
    const contactInfo = {};

    try {
      // Try to parse as JSON first
      try {
        const parsed = JSON.parse(data);
        console.log('Parsed as JSON:', parsed);
        return parsed;
      } catch {
        // If not JSON, try to extract information using various methods
        const lines = data.split('\n');
        
        // Helper function to clean and extract text
        const cleanText = (text) => {
          return text
            .replace(/^[^:]*:/, '') // Remove prefix before colon
            .replace(/^[^=]*=/, '') // Remove prefix before equals
            .trim();
        };

        // Process each line
        lines.forEach(line => {
          const lowerLine = line.toLowerCase();
          
          // Name detection
          if (!contactInfo.name) {
            if (lowerLine.includes('fn:') || lowerLine.includes('name:') || 
                lowerLine.includes('fullname:') || lowerLine.includes('contact:')) {
              contactInfo.name = cleanText(line);
            } else if (line.match(/^[A-Za-z\s]+$/)) {
              // If line contains only letters and spaces, it might be a name
              contactInfo.name = line.trim();
            }
          }

          // Email detection
          if (!contactInfo.email) {
            if (lowerLine.includes('email:') || lowerLine.includes('mail:')) {
              contactInfo.email = cleanText(line);
            } else if (line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)) {
              // If line matches email pattern
              contactInfo.email = line.trim();
            }
          }

          // Phone detection
          if (!contactInfo.phone) {
            if (lowerLine.includes('tel:') || lowerLine.includes('phone:') || 
                lowerLine.includes('mobile:') || lowerLine.includes('contact:')) {
              contactInfo.phone = cleanText(line);
            } else if (line.match(/[\d\s+()-]{8,}/)) {
              // If line contains 8 or more digits/spaces/plus signs
              contactInfo.phone = line.trim();
            }
          }

          // Company detection
          if (!contactInfo.company) {
            if (lowerLine.includes('org:') || lowerLine.includes('company:') || 
                lowerLine.includes('organization:') || lowerLine.includes('firm:')) {
              contactInfo.company = cleanText(line);
            }
          }
        });

        // If we have a comma-separated string, try to parse it
        if (data.includes(',') && Object.keys(contactInfo).length === 0) {
          data.split(',').forEach(item => {
            const [key, value] = item.split(':').map(part => part.trim());
            if (key && value) {
              const lowerKey = key.toLowerCase();
              if (lowerKey.includes('name') && !contactInfo.name) contactInfo.name = value;
              if (lowerKey.includes('email') && !contactInfo.email) contactInfo.email = value;
              if (lowerKey.includes('phone') && !contactInfo.phone) contactInfo.phone = value;
              if (lowerKey.includes('company') && !contactInfo.company) contactInfo.company = value;
            }
          });
        }

        // If we still don't have a name but have some text, use the first line as name
        if (!contactInfo.name && lines[0]) {
          contactInfo.name = lines[0].trim();
        }

        console.log('Extracted information:', contactInfo);
        return contactInfo;
      }
    } catch (error) {
      console.error("Error parsing QR data:", error);
      // Return whatever information we managed to extract
      return contactInfo;
    }
  };

  const startScanner = async () => {
    if (!hasCamera) {
      setStatus({ 
        type: 'error', 
        message: 'No camera available. Please connect a camera and try again.' 
      });
      return;
    }

    try {
      if (html5QrCodeRef.current) {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current = null;
      }
      initScanner();
    } catch (error) {
      console.error('Error in startScanner:', error);
      setStatus({ 
        type: 'error', 
        message: 'Error starting scanner: ' + error.message 
      });
    }
  };

  const initScanner = async () => {
    if (!scannerRef.current) {
      console.error('Scanner ref is not available');
      return;
    }
    
    setStatus({ type: 'info', message: 'Starting camera...' });
    setScanning(true);
    
    try {
      // Check if we're in a secure context
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        throw new Error('Camera access requires HTTPS. Please use a secure connection.');
      }

      // Check camera permissions
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop()); // Stop the test stream

      const html5QrCode = new Html5Qrcode("scanner");
      html5QrCodeRef.current = html5QrCode;
      
      await html5QrCode.start(
        { facingMode: "environment" }, // Try back camera first
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          disableFlip: false,
          showTorchButtonIfSupported: true,
        },
        (decodedText) => {
          console.log('QR Code detected:', decodedText);
          const parsedData = parseQRData(decodedText);
          console.log('Parsed data:', parsedData);
          
          if (Object.keys(parsedData).length === 0) {
            setStatus({ type: 'error', message: 'No valid information found in QR code' });
            return;
          }
          
          setScannedData(parsedData);
          setStatus({ type: 'success', message: 'Badge scanned successfully!' });
          stopScanner();
        },
        (errorMessage) => {
          console.log('Scanner error:', errorMessage);
          if (errorMessage.includes('No MultiFormat Readers were able to detect the code')) {
            setStatus({ type: 'info', message: 'No QR code detected. Please try again.' });
          } else {
            setStatus({ type: 'error', message: 'Scanner error: ' + errorMessage });
          }
        }
      );
    } catch (error) {
      console.error('Scanner initialization error:', error);
      let errorMessage = 'Camera access error: ';
      
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Camera access was denied. Please allow camera access and try again.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No camera found. Please connect a camera and try again.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Camera is already in use by another application.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage += 'Camera constraints could not be satisfied.';
      } else {
        errorMessage += error.message;
      }
      
      setStatus({ type: 'error', message: errorMessage });
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    try {
      if (html5QrCodeRef.current) {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current = null;
      }
      setScanning(false);
      setStatus({ type: 'info', message: 'Scanner stopped' });
    } catch (error) {
      console.error("Error stopping scanner:", error);
    }
  };

  const handleManualEntry = (e) => {
    const { name, value } = e.target;
    setManualEntry(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const submitManualEntry = () => {
    if (!manualEntry.name) {
      setStatus({ type: 'error', message: 'Please enter at least a name' });
      return;
    }

    setScannedData(manualEntry);
    setStatus({ type: 'success', message: 'Information collected successfully!' });
  };

  const resetScan = () => {
    setScannedData(null);
    setNotes('');
    setInterestLevel('Medium');
    setManualEntry({
      name: '',
      email: '',
      phone: '',
      company: ''
    });
    setStatus({ type: 'info', message: 'Ready to scan' });
  };

  const submitToGoogleSheets = async () => {
    if (!scannedData) {
      setStatus({ type: 'error', message: 'No data to submit' });
      return;
    }

    setLoading(true);
    setStatus({ type: 'info', message: 'Submitting data...' });

    try {
      const submissionData = {
        timestamp: new Date().toISOString(),
        name: scannedData.name || scannedData.fullName || '',
        email: scannedData.email || '',
        phone: scannedData.phone || scannedData.phoneNumber || '',
        company: scannedData.company || scannedData.organization || '',
        interestLevel,
        notes,
        rawData: scannedData.rawData || JSON.stringify(scannedData)
      };

      // Send data to Google Apps Script web app
      const response = await fetch('https://script.google.com/macros/s/AKfycbxmvyZX96zpgO2eBnDgPOrYyP-X-ZdN6Lb5wdvi8J5V9Xg-BOikeAI-YowoKYKWQWgE/exec', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain', // Change content type
        },
        body: JSON.stringify(submissionData),
      });

      // Handle the response
      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        throw new Error('Invalid response from server');
      }

      if (result.result === 'error') {
        throw new Error(result.error);
      }

      setLastSubmission(submissionData);
      setStatus({ type: 'success', message: 'Data submitted successfully!' });
      resetScan();
    } catch (error) {
      console.error("Error submitting data:", error);
      setStatus({ type: 'error', message: 'Error submitting data: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(err => {
          console.error("Error stopping scanner on unmount:", err);
        });
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-md mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 text-center">Badge Scanner</h1>
        <p className="text-gray-600 text-center">Scan visitor badges to collect contact info</p>
      </header>

      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
        <div 
          id="scanner" 
          ref={scannerRef} 
          className="w-full h-64 bg-gray-200 relative"
        >
          {!scanning && !scannedData && (
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <Camera className="w-12 h-12 text-gray-400 mb-2" />
              <p className="text-gray-500">Camera preview will appear here</p>
            </div>
          )}
        </div>

        <div className="p-4">
          {/* Status message */}
          <div className={`mb-4 p-3 rounded-md flex items-center ${
            status.type === 'error' ? 'bg-red-50 text-red-700' : 
            status.type === 'success' ? 'bg-green-50 text-green-700' : 
            'bg-blue-50 text-blue-700'
          }`}>
            {status.type === 'error' ? <AlertCircle className="w-5 h-5 mr-2" /> : 
             status.type === 'success' ? <CheckCircle className="w-5 h-5 mr-2" /> :
             <RefreshCw className={`w-5 h-5 mr-2 ${loading ? 'animate-spin' : ''}`} />}
            <span>{status.message}</span>
          </div>

          {!scannedData ? (
            <div className="space-y-4">
              {/* Scanner controls */}
              <button
                onClick={scanning ? stopScanner : startScanner}
                disabled={!hasCamera}
                className={`w-full py-4 px-6 rounded-lg font-bold text-lg ${
                  scanning 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : hasCamera
                      ? 'bg-teal-600 hover:bg-teal-700 text-white'
                      : 'bg-gray-400 cursor-not-allowed text-white'
                } shadow-md`}
              >
                {scanning ? 'Stop Scanner' : hasCamera ? 'Start Scanner' : 'No Camera Available'}
              </button>

              {/* Manual entry form */}
              <div className="border-t pt-4 mt-4">
                <h3 className="text-lg font-medium text-gray-700 mb-4">Or enter information manually:</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 flex items-center">
                      <User className="w-4 h-4 mr-2" />
                      Name
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={manualEntry.name}
                      onChange={handleManualEntry}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      placeholder="Enter visitor's name"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 flex items-center">
                      <Mail className="w-4 h-4 mr-2" />
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={manualEntry.email}
                      onChange={handleManualEntry}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      placeholder="Enter visitor's email"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 flex items-center">
                      <Phone className="w-4 h-4 mr-2" />
                      Phone
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={manualEntry.phone}
                      onChange={handleManualEntry}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      placeholder="Enter visitor's phone number"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 flex items-center">
                      <Building className="w-4 h-4 mr-2" />
                      Company
                    </label>
                    <input
                      type="text"
                      name="company"
                      value={manualEntry.company}
                      onChange={handleManualEntry}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      placeholder="Enter visitor's company"
                    />
                  </div>

                  <button
                    onClick={submitManualEntry}
                    className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-md font-medium"
                  >
                    Submit Information
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border rounded-md p-3 bg-gray-50">
                <h3 className="font-medium text-gray-700 mb-2">Collected Information</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Name:</span> {scannedData.name || scannedData.fullName || 'N/A'}</p>
                  <p><span className="font-medium">Email:</span> {scannedData.email || 'N/A'}</p>
                  <p><span className="font-medium">Phone:</span> {scannedData.phone || scannedData.phoneNumber || 'N/A'}</p>
                  <p><span className="font-medium">Company:</span> {scannedData.company || scannedData.organization || 'N/A'}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Interest Level
                </label>
                <select
                  value={interestLevel}
                  onChange={(e) => setInterestLevel(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Notes
                </label>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {noteSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => addNoteSuggestion(suggestion)}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full hover:bg-blue-200 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    rows="3"
                    placeholder="Add any notes about the interaction..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={resetScan}
                  className="w-full py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-md font-medium"
                >
                  Scan Again
                </button>
                <button
                  onClick={submitToGoogleSheets}
                  disabled={loading}
                  className={`w-full py-2 px-4 rounded-md font-medium flex items-center justify-center ${
                    loading 
                      ? 'bg-teal-400 cursor-not-allowed' 
                      : 'bg-teal-600 hover:bg-teal-700'
                  } text-white`}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Submit
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {lastSubmission && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Last Submission</h2>
          <pre className="text-sm text-gray-600 overflow-x-auto">
            {JSON.stringify(lastSubmission, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
