const SHAPES = ['Circle', 'Triangle', 'Cross', 'Square', 'Star'];

export default function ShapeModal({ onSelect }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-80">
        <h3 className="text-center font-bold text-lg mb-4 text-green-900">Choose a Shape</h3>
        <div className="grid grid-cols-3 gap-3">
          {SHAPES.map((s) => (
            <button
              key={s}
              onClick={() => onSelect(s)}
              className="bg-green-700 hover:bg-green-600 text-white py-3 rounded-lg font-semibold"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}