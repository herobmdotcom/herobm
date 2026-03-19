fetch('http://erpnext-backend:8000/api/resource/Account?fields=["name","parent_account","is_group","account_type"]&filters=[["company","=","ModBM"]]&limit_page_length=200', {
    headers: {
        'Authorization': `token 600590ca35cffc5:52427a21195620f`,
        'Accept': 'application/json'
    }
}).then(r => r.json()).then(data => console.log(JSON.stringify(data.data, null, 2))).catch(console.error);
