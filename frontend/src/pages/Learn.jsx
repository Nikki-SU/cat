/**
 * Study Page
 */
import { useState } from "react";

function Learn() {
  const [queueLength, setQueueLength] = useState(5);
  
  const queueOptions = [5, 7, 9];
  
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Learning Center</h1>
      
      <div className="mb-4">
        <label className="block mb-2">Queue Length:</label>
        <div className="flex gap-2">
          {queueOptions.map(n => (
            <button 
              key={n}
              onClick={() => setQueueLength(n)}
              className={`px-4 py-2 rounded ${queueLength === n ? "bg-blue-600 text-white" : "bg-gray-200"}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      
      <button className="bg-blue-600 text-white px-6 py-2 rounded">
        Start Learning ({queueLength} per group)
      </button>
    </div>
  );
}

export default Learn;
