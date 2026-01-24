let submitBtn = document.querySelector("#submit-btn")
if (submitBtn != null) {
    submitBtn.addEventListener("click", () => {
        let emailEl = document.querySelector("#input-email")
        console.log(emailEl.innerHTML)
        let pasaswordEl = document.querySelector("#input-password")
        let emailErrorParagraf = document.querySelector(".authentication-format-error-email")



        let authenticationFeedbackEl = document.querySelector(".authentication-feedback-message")
        if(!emailEl.value.toLowerCase().includes("@student.mdu.se")){
            emailErrorParagraf.innerHTML = "Email is incorrectly formatted!"
            
        }
        else{
            emailErrorParagraf.innerHTML = ""
            authenticationFeedbackEl.innerHTML = "Trying to Sign up, please wait..."
            
        }

    })

}