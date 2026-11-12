using System.Globalization;
using System.Text;

namespace ScoutReporter.Reader;

/// <summary>Small, fast streaming JSON writer with no dependencies. Adapted from FMSuperScout (MIT).</summary>
internal sealed class JsonWriter : IDisposable
{
    private readonly TextWriter _w;
    private readonly StringBuilder _sb = new(1 << 16);
    private bool _needComma;
    private bool _closed;

    public JsonWriter(TextWriter writer) { _w = writer; }

    public static JsonWriter ToFile(string path) =>
        new(new StreamWriter(path, false, new UTF8Encoding(false), 1 << 20));

    private void Sep()
    {
        if (_needComma) _sb.Append(',');
        _needComma = false;
        if (_sb.Length > (1 << 15)) { _w.Write(_sb); _sb.Clear(); }
    }

    public void BeginObj() { Sep(); _sb.Append('{'); }
    public void EndObj() { _sb.Append('}'); _needComma = true; }
    public void BeginArr() { Sep(); _sb.Append('['); }
    public void EndArr() { _sb.Append(']'); _needComma = true; }

    public void Key(string name)
    {
        Sep();
        AppendString(name);
        _sb.Append(':');
    }

    private void AppendString(string s)
    {
        _sb.Append('"');
        foreach (var c in s)
        {
            switch (c)
            {
                case '"': _sb.Append("\\\""); break;
                case '\\': _sb.Append("\\\\"); break;
                case '\n': _sb.Append("\\n"); break;
                case '\r': _sb.Append("\\r"); break;
                case '\t': _sb.Append("\\t"); break;
                default:
                    if (c < 0x20) _sb.Append("\\u").Append(((int)c).ToString("x4"));
                    else _sb.Append(c);
                    break;
            }
        }
        _sb.Append('"');
    }

    public void Val(string s)
    {
        Sep();
        if (s == null) _sb.Append("null");
        else AppendString(s);
        _needComma = true;
    }

    public void Val(long v) { Sep(); _sb.Append(v.ToString(CultureInfo.InvariantCulture)); _needComma = true; }
    public void Val(double v) { Sep(); _sb.Append(double.IsFinite(v) ? v.ToString("R", CultureInfo.InvariantCulture) : "null"); _needComma = true; }
    public void Val(bool v) { Sep(); _sb.Append(v ? "true" : "false"); _needComma = true; }
    public void Null() { Sep(); _sb.Append("null"); _needComma = true; }

    public void Prop(string k, string v) { Key(k); Val(v); }   // v == null writes null
    public void Prop(string k, long v) { Key(k); Val(v); }
    public void Prop(string k, double v) { Key(k); Val(v); }
    public void Prop(string k, bool v) { Key(k); Val(v); }
    public void PropNull(string k) { Key(k); Null(); }
    /// <summary>A number, or null when it is negative or zero (unknown).</summary>
    public void PropPositive(string k, long v) { if (v > 0) Prop(k, v); else PropNull(k); }

    public void Close()
    {
        if (_closed) return;
        _closed = true;
        _w.Write(_sb);
        _sb.Clear();
        _w.Flush();
        _w.Dispose();
    }

    // Safety net for an exception mid-write (full disk, antivirus lock): release the file without
    // writing more, so the next attempt is not blocked by a handle held until some later GC.
    public void Dispose()
    {
        if (_closed) return;
        _closed = true;
        try { _w.Dispose(); } catch { }
    }
}
