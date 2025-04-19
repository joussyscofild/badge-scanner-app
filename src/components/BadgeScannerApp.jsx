import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Clipboard, Send, Camera, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

export default function BadgeScannerApp() {
  const [scanning, setScanning] = useState(false);
  const [scannedData, setScannedData] = useState(null);
  const [notes, setNotes] = useState('');
  const [interestLevel, setInterestLevel] = useState('Medium');
  const [status, setStatus] = useState({ type: 'info', message: 'Ready to scan' });
  const [lastSubmission, setLastSubmission] = useState(null);
  const [loading, setLoading] = useState(false);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  // Parse QR code data into structured format
  const parseQRData = (data) => {
    try {
      // Try to parse as JSON first
      try {
        return JSON.parse(data);
      } catch {
        // If not JSON, try to parse as vCard or other formats
        const contactInfo = {};
        
        // Simple vCard-like format parsing
        if (data.includes('BEGIN:VCARD')) {
          if (data.includes('FN:')) {
            contactInfo.name = data.split('FN:')[1].split('\n')[0].trim();
          }
          if (data.includes('EMAIL:')) {
            contactInfo.email = data.split('EMAIL:')[1].split('\n')[0].trim();
          }
          if (data.includes('TEL:')) {
            contactInfo.phone = data.split('TEL:')[1].split('\n')[0].trim();
          }
          if (data.includes('ORG:')) {
            contactInfo.company = data.split('ORG:')[1].split('\n')[0].trim();
          }
          return contactInfo;
        }
        
        // Simple key-value format (name:John Doe,email:john@example.com)
        if (data.includes(':') && data.includes(',')) {
          data.split(',').forEach(item => {
            const [key, value] = item.split(':');
            if (key && value) {
              contactInfo[key.trim().toLowerCase()] = value.trim();
            }
          });
          return contactInfo;
        }
        
        // If all else fails, just return the raw data
        return { rawData: data };
      }
    } catch (error) {
      console.error("Error parsing QR data:", error);
      return { rawData: data };
    }
  };

  const startScanner = () => {
    if (html5QrCodeRef.current) {
      html5QrCodeRef.current.stop().then(() => {
        html5QrCodeRef.current = null;
        initScanner();
      }).catch(err => {
        console.error("Error stopping scanner:", err);
        html5QrCodeRef.current = null;
        initScanner();
      });
    } else {
      initScanner();
    }
  };

  const initScanner = () => {
    if (!scannerRef.current) return;
    
    setStatus({ type: 'info', message: 'Starting camera...' });
    setScanning(true);
    
    const html5QrCode = new Html5Qrcode("scanner");
    html5QrCodeRef.current = html5QrCode;
    
    html5QrCode.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
      },
      (decodedText) => {
        // Success callback
        const parsedData = parseQRData(decodedText);
        setScannedData(parsedData);
        setStatus({ type: 'success', message: 'Badge scanned successfully!' });
        
        // Stop scanning after successful scan
        html5QrCode.stop().catch(err => {
          console.error("Error stopping scanner after scan:", err);
        });
        setScanning(false);
      },
      (errorMessage) => {
        // Error callback is called continuously while scanning, so we don't want to update state here
        console.log(errorMessage);
      }
    ).catch(err => {
      setStatus({ type: 'error', message: 'Camera access error: ' + err });
      setScanning(false);
    });
  };

  const stopScanner = () => {
    if (html5QrCodeRef.current) {
      html5QrCodeRef.current.stop().then(() => {
        html5QrCodeRef.current = null;
        setScanning(false);
        setStatus({ type: 'info', message: 'Scanner stopped' });
      }).catch(err => {
        console.error("Error stopping scanner:", err);
      });
    }
  };

  const resetScan = () => {
    setScannedData(null);
    setNotes('');
    setInterestLevel('Medium');
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
      // Prepare data for submission
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

      // In a real implementation, this would call the Google Apps Script web app URL
      // For demo purposes, we'll simulate a successful submission
      
      // Simulating API call to Google Apps Script
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In production, you would use fetch:
      
      const response = await fetch('https://script.google.com/macros/s/AKfycbwxjuHkoO-h8RKPNinZfU1SLpirhFnQAGYe-fj8qt2WM2kotGtrmX6C6sNiAhFdyVoh/exec', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit data');
      }
      
      const result = await response.json();
      

      // Store the last submission for reference
      setLastSubmission(submissionData);
      
      // Success feedback
      setStatus({ type: 'success', message: 'Data submitted successfully!' });
      
      // Reset for next scan
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

          {/* Scanner controls */}
          {!scannedData ? (
            <button
              onClick={scanning ? stopScanner : startScanner}
              className={`w-full py-3 px-4 rounded-md font-medium ${
                scanning 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-teal-600 hover:bg-teal-700 text-white'
              }`}
            >
              {scanning ? 'Stop Scanner' : 'Start Scanner'}
            </button>
          ) : (
            <div className="space-y-4">
              <div className="border rounded-md p-3 bg-gray-50">
                <h3 className="font-medium text-gray-700 mb-2">Scanned Information</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Name:</span> {scannedData.name || scannedData.fullName || 'N/A'}</p>
                  <p><span className="font-medium">Email:</span> {scannedData.email || 'N/A'}</p>
                  <p><span className="font-medium">Phone:</span> {scannedData.phone || scannedData.phoneNumber || 'N/A'}</p>
                  <p><span className="font-medium">Company:</span> {scannedData.company || scannedData.organization || 'N/A'}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Interest Level
                </label>
                <select
                  value={interestLevel}
                  onChange={(e) => setInterestLevel(e.target.value)}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Very High">Very High</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any additional notes about this visitor..."
                  className="w-full p-2 border rounded-md h-24"
                />
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={resetScan}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Reset
                </button>
                <button
                  onClick={submitToGoogleSheets}
                  disabled={loading}
                  className="flex-1 py-2 px-4 bg-teal-600 text-white rounded-md hover:bg-teal-700 flex items-center justify-center"
                >
                  {loading ? (
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <Send className="w-5 h-5 mr-2" />
                  )}
                  Submit
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Last submission */}
      {lastSubmission && (
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-gray-700">Last Submission</h3>
            <span className="text-xs text-gray-500">
              {new Date(lastSubmission.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <div className="text-sm text-gray-600">
            <p>{lastSubmission.name} - {lastSubmission.company}</p>
            <p className="text-xs mt-1">Interest: {lastSubmission.interestLevel}</p>
          </div>
        </div>
      )}

      {/* Instructions for Google Apps Script Integration */}
      <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800 mb-6">
        <h3 className="font-medium mb-2 flex items-center">
          <Clipboard className="w-4 h-4 mr-1" />
          Google Sheets Integration
        </h3>
        <p className="mb-2">
          To connect this app to Google Sheets, you'll need to create a Google Apps Script:
        </p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Create a Google Sheet with columns matching the data fields</li>
          <li>Go to Extensions → Apps Script</li>
          <li>Replace the code with the Google Apps Script provided separately</li>
          <li>Deploy as a web app and copy the URL</li>
          <li>Replace 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL' in this code</li>
        </ol>
      </div>
    </div>
  );
}