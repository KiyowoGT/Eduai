export function SparkBar({ data, color, className = "h-10", barClassName = "w-2" }) {
  const max = Math.max(...data, 1);
  return (
    <div className={`flex items-end gap-[2px] ${className}`}>
      {data.map((v, i) => (
        <div
          key={i}
          className={`${barClassName} rounded-t-sm ${color}`}
          style={{ height: `${(v / max) * 100}%` }}
        />
      ))}
    </div>
  );
}
