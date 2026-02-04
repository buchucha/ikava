
const ORTHANC_URL = "https://ikava.tailbce91b.ts.net:8443";

/**
 * Searches for studies in Orthanc by PatientID (Chart Number).
 * Returns the StudyInstanceUID of the most recent study.
 */
export const getPatientLatestStudy = async (chartNumber: string): Promise<string | null> => {
  if (!chartNumber) return null;

  try {
    // QIDO-RS endpoint to find studies filtered by PatientID
    // limit=1 and sort=-StudyDate gets the latest one
    // We use encodeURIComponent to ensure special characters in chartNumber don't break the URL
    const url = `${ORTHANC_URL}/dicom-web/studies?PatientID=${encodeURIComponent(chartNumber)}&limit=1&sort=-StudyDate`;
    
    const response = await fetch(url, {
       method: 'GET',
       headers: {
         'Accept': 'application/json'
       },
       // Important: Include credentials to pass auth cookies if the user is logged into Orthanc
       credentials: 'include'
    });

    if (!response.ok) {
       console.warn(`Orthanc API Error: ${response.status} ${response.statusText}`);
       return null;
    }

    const studies = await response.json();
    
    if (studies && studies.length > 0) {
       // Extract StudyInstanceUID (Tag 0020000D)
       const uidTag = studies[0]["0020000D"];
       if (uidTag && uidTag.Value && uidTag.Value.length > 0) {
          return uidTag.Value[0];
       }
    }
    
    return null;

  } catch (e) {
    console.error("Failed to connect to Orthanc:", e);
    return null;
  }
};
