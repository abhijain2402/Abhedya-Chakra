import React, { useState } from 'react';
import { runDataAnalysis, uploadDatasetFile } from '../services/api';
import { Play, Upload, AlertCircle } from 'lucide-react';

export default function DataAnalysisView() {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  const steps = [
    'Dataset file found',
    'Transaction account columns validated',
    'Transaction rows and unique accounts measured',
    'Diagnostics completed'
  ];

  const handleStartAnalysis = async (datasetName = uploadResult?.filename || 'VoidHacks8_MuleAccount_2M_Transactions.csv') => {
    setAnalyzing(true);
    setAnalysisResult(null);
    setAnalysisError(null);

    try {
      const result = await runDataAnalysis(datasetName);
      setAnalysisResult(result);
    } catch (err) {
      console.error('Analysis error:', err);
      setAnalysisError(err.message || 'Failed to analyze this transaction dataset.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadError(null);
      setUploadResult(null);
      setAnalysisResult(null);
    }
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadError(null);

    try {
      const res = await uploadDatasetFile(selectedFile);
      setUploadResult(res);
      await handleStartAnalysis(res.filename);
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError(err.message || 'Failed to upload dataset file');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">2. Data Analysis & Dataset Diagnostics</h1>
        <p className="page-description">
          Inspect transaction dataset structure, row counts, unique accounts, and missing account identifiers.
        </p>
      </div>

      {/* Upload Custom Dataset Section */}
      <div className="card mb-32" style={{ border: '1px solid var(--accent-blue)' }}>
        <div className="flex-between mb-20">
          <div>
            <h3 style={{ fontSize: '18px', color: '#ffffff' }}>Upload Custom Transaction Dataset</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Upload a CSV or Parquet transaction dataset with Sender_Account and Receiver_Account columns to inspect its records and accounts.
            </p>
          </div>
          <span className="badge badge-layer-l1">TRANSACTION DATASET DIAGNOSTICS</span>
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', background: '#0b0f19', padding: '16px', borderRadius: '10px', border: '1px dashed var(--border-light)' }}>
          <Upload size={24} color="#60a5fa" />
          <input
            type="file"
            accept=".csv,.parquet"
            onChange={handleFileChange}
            style={{ color: '#ffffff', fontSize: '14px', flex: 1 }}
          />
          <button
            className="btn btn-primary"
            disabled={!selectedFile || uploading}
            onClick={handleUploadSubmit}
          >
            <Upload size={16} />
            <span>{uploading ? 'Uploading & Analyzing...' : 'Upload & Analyze Dataset'}</span>
          </button>
        </div>

        {uploadError && (
          <div style={{ marginTop: '12px', color: '#fca5a5', fontSize: '13px' }}>
            <AlertCircle size={14} style={{ display: 'inline', marginRight: '6px' }} />
            {uploadError}
          </div>
        )}

        {uploadResult && (
          <div style={{ marginTop: '16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '14px', borderRadius: '8px' }}>
            <strong style={{ color: '#6ee7b7', display: 'block', marginBottom: '4px' }}>
              ✓ Dataset Uploaded and Validated: {uploadResult.filename}
            </strong>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Size: {uploadResult.size_mb} MB | Transaction columns validated | Diagnostics are shown below
            </span>
          </div>
        )}
      </div>

      {/* Active Dataset File Info Card */}
      <div className="card mb-32">
        <div className="flex-between mb-20">
          <div>
            <h3 style={{ fontSize: '18px', color: '#ffffff' }}>Active Dataset File</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {uploadResult ? uploadResult.filename : 'VoidHacks8 Mule Account Transaction Dataset'}
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => handleStartAnalysis()}
            disabled={analyzing || uploading || Boolean(selectedFile && !uploadResult)}
          >
            <Play size={16} />
            <span>{analyzing ? 'Analyzing Dataset...' : 'Analyze Dataset'}</span>
          </button>
        </div>

        <div className="grid-cols-3">
          <div className="card" style={{ background: '#0b0f19' }}>
            <div className="stat-label">File Name</div>
            <strong style={{ fontSize: '15px', color: '#93c5fd' }}>
              {uploadResult ? uploadResult.filename : 'VoidHacks8_MuleAccount_2M_Transactions.csv'}
            </strong>
          </div>

          <div className="card" style={{ background: '#0b0f19' }}>
            <div className="stat-label">File Size</div>
            <strong style={{ fontSize: '18px', color: '#ffffff' }}>
              {uploadResult ? `${uploadResult.size_mb} MB` : 'Run analysis to measure'}
            </strong>
          </div>

          <div className="card" style={{ background: '#0b0f19' }}>
            <div className="stat-label">Record Count</div>
            <strong style={{ fontSize: '18px', color: '#ffffff' }}>
              {analysisResult ? `${analysisResult.records_analyzed?.toLocaleString()} Transactions` : 'Run analysis to count'}
            </strong>
          </div>
        </div>
        {selectedFile && !uploadResult && (
          <p style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: 13 }}>
            Upload the selected file above before running diagnostics on it.
          </p>
        )}
      </div>

      {/* Pipeline Stage Progress */}
      <div className="card mb-32">
        <h3 style={{ fontSize: '18px', color: '#ffffff', marginBottom: '16px' }}>Analysis Pipeline Stages</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {steps.map((stepText, idx) => {
            const isDone = Boolean(analysisResult);
            const isCurrent = analyzing && idx === 2;

            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  background: isCurrent ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-dark)',
                  border: isCurrent ? '1px solid var(--accent-blue)' : '1px solid var(--border-color)'
                }}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isDone ? '#10b981' : isCurrent ? '#3b82f6' : '#1f293d',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                >
                  {isDone ? '✓' : isCurrent ? '…' : idx + 1}
                </div>
                <span
                  style={{
                    color: isDone ? '#ffffff' : isCurrent ? '#60a5fa' : 'var(--text-muted)',
                    fontWeight: isCurrent ? '600' : '400'
                  }}
                >
                  {stepText}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {analysisError && (
        <div className="card" role="alert" style={{ marginBottom: 24, color: '#fca5a5' }}>
          <AlertCircle size={16} style={{ display: 'inline', marginRight: 8 }} />
          {analysisError}
        </div>
      )}

      {analysisResult && (
        <div className="card" style={{ border: '1px solid var(--accent-blue)' }}>
          <div className="flex-between mb-20">
            <div>
              <span className="badge badge-low">Dataset Diagnostics</span>
              <h2 style={{ fontSize: '24px', color: '#ffffff', marginTop: '8px' }}>
                {analysisResult.dataset_name}
              </h2>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="stat-label">Measured scan time</div>
              <strong style={{ fontSize: '20px', color: '#93c5fd' }}>
                {analysisResult.execution_timing?.total_execution_sec}s
              </strong>
            </div>
          </div>

          <div className="grid-cols-3 mb-20">
            <div className="card stat-card">
              <div className="stat-label">Transactions</div>
              <div className="stat-value">{analysisResult.records_analyzed?.toLocaleString()}</div>
            </div>
            <div className="card stat-card">
              <div className="stat-label">Unique Accounts</div>
              <div className="stat-value">{analysisResult.accounts_analyzed?.toLocaleString()}</div>
            </div>
            <div className="card stat-card">
              <div className="stat-label">Missing Account IDs</div>
              <div className="stat-value">
                {(
                  (analysisResult.missing_sender_account_count || 0)
                  + (analysisResult.missing_receiver_account_count || 0)
                ).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Account field</th>
                  <th>Unique account IDs</th>
                  <th>Missing IDs</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Sender</td>
                  <td>{analysisResult.sender_accounts?.toLocaleString()}</td>
                  <td>{analysisResult.missing_sender_account_count?.toLocaleString()}</td>
                </tr>
                <tr>
                  <td>Receiver</td>
                  <td>{analysisResult.receiver_accounts?.toLocaleString()}</td>
                  <td>{analysisResult.missing_receiver_account_count?.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
