interface Artifact {
  name: string;
  data: unknown;
}

export function ArtifactCanvas({ onClose }: { onClose: () => void }) {
  // For now, we'll use static artifacts
  const artifacts: Artifact[] = [];

  return (
    <div className="h-full bg-white border-l shadow-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Artifacts</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-full"
        >
          ✕
        </button>
      </div>
      <div className="space-y-4">
        {artifacts.map((artifact, index) => (
          <div key={index} className="border rounded-lg p-4">
            <h3 className="font-medium mb-2">{artifact.name}</h3>
            <pre className="bg-gray-50 p-2 rounded overflow-auto text-sm">
              {JSON.stringify(artifact.data, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
