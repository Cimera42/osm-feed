function nowString(date)
{
    return "[" + date.toLocaleString("en-au", {hour12:false}) + "]";
}
module.exports = function() {
    let date = new Date();
    let s = nowString(date);
	for(const key in arguments)
	{
		try
		{
			s += " " + JSON.stringify(arguments[key]);
		}
		catch(e)
		{
			s += " [INVALID JSON OBJECT]";
		}
	}
    console.log(s);
};
