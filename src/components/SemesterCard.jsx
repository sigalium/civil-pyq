import './css/SemesterCard.css'

const SemesterCard = ({ semester, onClick }) => {
  return (
    <button className="semester-card" onClick={onClick}>
      <span>Semester</span>
      <h3>{semester}</h3>
    </button>
  )
}

export default SemesterCard