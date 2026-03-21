exports.processCommand = async (req, res) => {

    const { command } = req.body;

    if(!command){
        return res.json({response:"No command received"});
    }

    const text = command.toLowerCase();

    if(text.includes("join queue")){
        return res.json({
            response:"You joined the queue successfully"
        });
    }

    if(text.includes("clinic")){
        return res.json({
            response:"Showing nearby clinics"
        });
    }

    if(text.includes("position")){
        return res.json({
            response:"You are currently in the queue"
        });
    }

    return res.json({
        response:"Sorry I didn't understand the command"
    });

};